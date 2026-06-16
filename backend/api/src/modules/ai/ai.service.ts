import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/users.entity';
import { UserCategoryScore } from '../scoring/user-category-score.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';
import { FraudFlag } from '../fraud/fraud-flag.entity';
import { Rating } from '../ratings/ratings.entity';
import { VoterReliability } from '../scoring/voter-reliability.entity';

// ─── Tipos de respuesta ───────────────────────────────────────────────────────

export interface CvAnalysisResult {
  extracted: {
    name:         string | null;
    roles:        string[];
    companies:    string[];
    years_exp:    number | null;
    skills:       string[];
  };
  coherence: {
    score:        number;   // 0–100, qué tan coherente es el CV con el perfil real
    flags:        string[]; // inconsistencias detectadas
    summary:      string;   // explicación en lenguaje natural
  };
}

export interface FraudAiAnalysis {
  risk_level:  'low' | 'medium' | 'high';
  confidence:  number;   // 0–100
  reasoning:   string;
  suggestions: string[]; // acciones recomendadas al admin
}

export interface HiringSuggestion {
  user_id:       number;
  name:          string;
  score:         number;
  justification: string;
  strengths:     string[];
  concerns:      string[];
}

@Injectable()
export class AiService {
  private readonly apiKey: string;
  private readonly model = 'claude-sonnet-4-20250514';

  constructor(
    private config: ConfigService,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(UserCategoryScore)
    private categoryScoreRepo: Repository<UserCategoryScore>,

    @InjectRepository(EvaluationCategory)
    private categoryRepo: Repository<EvaluationCategory>,

    @InjectRepository(FraudFlag)
    private fraudFlagRepo: Repository<FraudFlag>,

    @InjectRepository(Rating)
    private ratingRepo: Repository<Rating>,

    @InjectRepository(VoterReliability)
    private reliabilityRepo: Repository<VoterReliability>,
  ) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY')!;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. ANÁLISIS DE CV
  // Extrae información del CV y la compara con el perfil real del usuario
  // ─────────────────────────────────────────────────────────────────────────────

  async analyzeCv(userId: number, cvText: string): Promise<CvAnalysisResult> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado');

    // Traer scores reales del usuario para comparar
    const categoryScores = await this.categoryScoreRepo
      .createQueryBuilder('ucs')
      .innerJoin(EvaluationCategory, 'cat', 'cat.id = ucs.evaluation_category_id')
      .select('cat.name',    'category')
      .addSelect('ucs.score', 'score')
      .addSelect('ucs.vote_count', 'votes')
      .where('ucs.user_id = :userId', { userId })
      .getRawMany();

    const scoresText = categoryScores.length > 0
      ? categoryScores.map(s => `- ${s.category}: ${Number(s.score).toFixed(1)}/100 (${s.votes} votos)`).join('\n')
      : 'Sin scores registrados aún';

    const prompt = `
Sos un experto en recursos humanos y análisis de perfiles profesionales.

Se te proporciona:
1. Un CV en texto plano
2. Los scores reales del usuario según evaluaciones de sus pares, empleadores y clientes

Tu tarea es:
1. Extraer información clave del CV
2. Detectar inconsistencias entre lo que dice el CV y lo que muestran los scores reales

CV:
"""
${cvText}
"""

Scores reales del usuario (evaluaciones verificadas):
${scoresText}

Respondé SOLO con JSON válido, sin texto adicional:
{
  "extracted": {
    "name": "nombre detectado o null",
    "roles": ["roles/títulos mencionados"],
    "companies": ["empresas mencionadas"],
    "years_exp": número o null,
    "skills": ["habilidades mencionadas"]
  },
  "coherence": {
    "score": número 0-100,
    "flags": ["inconsistencia 1", "inconsistencia 2"],
    "summary": "explicación en 2-3 oraciones"
  }
}
    `.trim();

    const response = await this.callApi(prompt);
    return JSON.parse(response) as CvAnalysisResult;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. ANÁLISIS DE FRAUDE ASISTIDO POR IA
  // Complementa el sistema de reglas con razonamiento en lenguaje natural
  // ─────────────────────────────────────────────────────────────────────────────

  async analyzeFraudRisk(userId: number): Promise<FraudAiAnalysis> {
    // Recolectar contexto del usuario
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado');

    const flags = await this.fraudFlagRepo
      .createQueryBuilder('flag')
      .innerJoin(Rating, 'rating', 'rating.id = flag.rating_id')
      .select('flag.type',        'type')
      .addSelect('flag.severity', 'severity')
      .addSelect('flag.notes',    'notes')
      .addSelect('flag.detected_by', 'detected_by')
      .where('rating.from_user_id = :userId', { userId })
      .getRawMany();

    const reliability = await this.reliabilityRepo.findOne({ where: { user_id: userId } });

    const recentRatings = await this.ratingRepo.find({
      where:  { from_user_id: userId },
      order:  { created_at: 'DESC' },
      take:   20,
    });

    const avgScore = recentRatings.length > 0
      ? recentRatings.reduce((a, r) => a + Number(r.score), 0) / recentRatings.length
      : null;

    const prompt = `
Sos un sistema de detección de fraude en una plataforma de reputación laboral.

Analizá el siguiente perfil y determiná el nivel de riesgo de fraude:

Usuario ID: ${userId}
Nombre: ${user.name}
Fraud score acumulado: ${user.fraud_score}
Bloqueado: ${user.is_blocked}
Reliability como votante: ${reliability?.reliability ?? 1.0}
Total votos emitidos: ${reliability?.total_votes_cast ?? 0}
Promedio de scores que emite: ${avgScore?.toFixed(1) ?? 'N/A'}

Flags de fraude detectados por el sistema:
${flags.length > 0
  ? flags.map(f => `- Tipo: ${f.type}, Severidad: ${f.severity}, Notas: ${f.notes ?? 'N/A'}`).join('\n')
  : '- Ninguno'}

Basándote en estos datos, evaluá:
1. ¿El patrón de flags es consistente con fraude real o puede ser falso positivo?
2. ¿La reliability baja se explica por comportamiento sospechoso o por diferencia de criterio?
3. ¿Qué acciones recomendás?

Respondé SOLO con JSON válido:
{
  "risk_level": "low" | "medium" | "high",
  "confidence": número 0-100,
  "reasoning": "explicación en 2-3 oraciones",
  "suggestions": ["acción 1", "acción 2"]
}
    `.trim();

    const response = await this.callApi(prompt);
    return JSON.parse(response) as FraudAiAnalysis;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SUGERENCIAS DE CONTRATACIÓN
  // Dado un job post y una lista de candidatos pre-filtrados por el matching,
  // la IA genera justificaciones en lenguaje natural y prioriza
  // ─────────────────────────────────────────────────────────────────────────────

  async generateHiringSuggestions(
    jobPostId:   number,
    jobTitle:    string,
    jobDesc:     string | null,
    candidates:  Array<{
      user_id:             number;
      compatibility_score: number;
      details:             Record<string, number>;
    }>,
  ): Promise<HiringSuggestion[]> {
    if (candidates.length === 0) return [];

    // Traer nombres de los candidatos
    const userIds  = candidates.map(c => c.user_id);
    const users    = await this.userRepo.findByIds(userIds);
    const userMap  = new Map(users.map(u => [u.id, u]));

    const candidatesText = candidates.map(c => {
      const user   = userMap.get(c.user_id);
      const scores = Object.entries(c.details)
        .map(([cat, score]) => `  ${cat}: ${score}/100`)
        .join('\n');
      return `
Candidato ID ${c.user_id} (${user?.name ?? 'Desconocido'}):
  Compatibilidad general: ${c.compatibility_score}/100
  Scores por categoría:
${scores}
      `.trim();
    }).join('\n\n');

    const prompt = `
Sos un consultor de recursos humanos experto.

Se busca cubrir el puesto: "${jobTitle}"
${jobDesc ? `Descripción: ${jobDesc}` : ''}

Los siguientes candidatos fueron pre-seleccionados por el sistema según sus scores verificados:

${candidatesText}

Para cada candidato generá una evaluación concisa. Ordenálos de mejor a peor.

Respondé SOLO con un array JSON válido:
[
  {
    "user_id": número,
    "name": "nombre",
    "score": número 0-100,
    "justification": "por qué es una buena opción en 1-2 oraciones",
    "strengths": ["fortaleza 1", "fortaleza 2"],
    "concerns": ["posible preocupación o ninguna"]
  }
]
    `.trim();

    const response = await this.callApi(prompt);
    return JSON.parse(response) as HiringSuggestion[];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER — llamada a la API de Anthropic
  // ─────────────────────────────────────────────────────────────────────────────

  private async callApi(prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      this.model,
        max_tokens: 1500,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new BadRequestException(`Error en API de Anthropic: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    // Limpiar posibles bloques de código markdown
    return text.replace(/```json|```/g, '').trim();
  }
}