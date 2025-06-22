// src/services/beautyProgressService.js
const supabase = require('../config/database');
const Logger = require('../utils/logger');
const { models } = require('../config/gemini');
const photoAnalysisService = require('./photoAnalysisService');

class BeautyProgressService {
  constructor() {
    this.improvementThresholds = {
      significant: 20, // 20% improvement
      moderate: 10,    // 10% improvement
      slight: 5        // 5% improvement
    };
  }

  /**
   * Track user's beauty progress over time
   */
  async trackProgress(userId, weekNumber, progressData) {
    try {
      Logger.info('Tracking beauty progress', { userId, weekNumber });

      // Get previous progress entries
      const previousProgress = await this.getPreviousProgress(userId, weekNumber);
      
      // Calculate improvements
      const improvements = await this.calculateImprovements(
        userId, 
        previousProgress, 
        progressData
      );

      // Save progress entry
      const { data, error } = await supabase
        .from('user_progress')
        .insert({
          user_id: userId,
          week_number: weekNumber,
          progress_photo_id: progressData.photo_id,
          analysis_id: progressData.analysis_id,
          skin_score: progressData.skin_score,
          concern_improvements: improvements.concerns,
          self_assessment: progressData.self_assessment,
          routine_adherence: progressData.routine_adherence,
          notes: progressData.notes
        })
        .select()
        .single();

      if (error) throw error;

      // Generate AI insights
      const insights = await this.generateProgressInsights(
        userId,
        weekNumber,
        improvements
      );

      return {
        progress_id: data.id,
        improvements,
        insights
      };

    } catch (error) {
      Logger.error('Track progress error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get previous progress entries
   */
  async getPreviousProgress(userId, currentWeek) {
    const { data, error } = await supabase
      .from('user_progress')
      .select(`
        *,
        photo_analyses(*)
      `)
      .eq('user_id', userId)
      .lt('week_number', currentWeek)
      .order('week_number', { ascending: false })
      .limit(4); // Get last 4 weeks

    if (error) {
      Logger.error('Get previous progress error', { error: error.message });
      return [];
    }

    return data;
  }

  /**
   * Calculate improvements between progress entries
   */
  async calculateImprovements(userId, previousProgress, currentData) {
    try {
      // Get baseline (first entry or 4 weeks ago)
      const baseline = previousProgress[previousProgress.length - 1] || previousProgress[0];
      
      if (!baseline || !baseline.photo_analyses?.[0]) {
        return {
          overall: 0,
          concerns: {},
          trend: 'stable'
        };
      }

      const baselineAnalysis = baseline.photo_analyses[0];
      const currentAnalysis = await this.getCurrentAnalysis(currentData.analysis_id);

      // Calculate overall skin score improvement
      const baselineScore = baselineAnalysis.overall_skin_score;
      const currentScore = currentAnalysis.overall_skin_score;
      const overallImprovement = ((currentScore - baselineScore) / baselineScore) * 100;

      // Calculate concern-specific improvements
      const concernImprovements = this.calculateConcernImprovements(
        baselineAnalysis.skin_concerns,
        currentAnalysis.skin_concerns
      );

      // Determine trend
      const trend = this.determineTrend(previousProgress, currentScore);

      return {
        overall: Math.round(overallImprovement * 10) / 10,
        concerns: concernImprovements,
        trend: trend,
        score_change: currentScore - baselineScore
      };

    } catch (error) {
      Logger.error('Calculate improvements error', { error: error.message });
      return { overall: 0, concerns: {}, trend: 'stable' };
    }
  }

  /**
   * Get current analysis data
   */
  async getCurrentAnalysis(analysisId) {
    const { data, error } = await supabase
      .from('photo_analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Calculate improvements for specific concerns
   */
  calculateConcernImprovements(baselineConcerns, currentConcerns) {
    const improvements = {};

    // Create concern maps for easier comparison
    const baselineMap = this.createConcernMap(baselineConcerns);
    const currentMap = this.createConcernMap(currentConcerns);

    // Calculate improvement for each concern
    for (const [concern, baselineSeverity] of Object.entries(baselineMap)) {
      const currentSeverity = currentMap[concern] || 0;
      const severityChange = this.calculateSeverityChange(
        baselineSeverity,
        currentSeverity
      );

      improvements[concern] = {
        baseline: baselineSeverity,
        current: currentSeverity,
        improvement_percentage: severityChange,
        status: this.getImprovementStatus(severityChange)
      };
    }

    // Check for new concerns
    for (const [concern, severity] of Object.entries(currentMap)) {
      if (!baselineMap[concern]) {
        improvements[concern] = {
          baseline: 0,
          current: severity,
          improvement_percentage: -100, // New concern
          status: 'new_concern'
        };
      }
    }

    return improvements;
  }

  /**
   * Create concern severity map
   */
  createConcernMap(concerns) {
    const map = {};
    
    for (const concern of concerns) {
      const severity = this.severityToNumber(concern.severity);
      if (!map[concern.type]) {
        map[concern.type] = severity;
      } else {
        map[concern.type] = Math.max(map[concern.type], severity);
      }
    }

    return map;
  }

  /**
   * Convert severity to numerical value
   */
  severityToNumber(severity) {
    const severityMap = {
      'mild': 1,
      'moderate': 2,
      'severe': 3,
      'unknown': 1
    };
    return severityMap[severity.toLowerCase()] || 1;
  }

  /**
   * Calculate severity change percentage
   */
  calculateSeverityChange(baseline, current) {
    if (baseline === 0) return 0;
    return Math.round(((baseline - current) / baseline) * 100);
  }

  /**
   * Get improvement status label
   */
  getImprovementStatus(changePercentage) {
    if (changePercentage >= this.improvementThresholds.significant) {
      return 'significant_improvement';
    } else if (changePercentage >= this.improvementThresholds.moderate) {
      return 'moderate_improvement';
    } else if (changePercentage >= this.improvementThresholds.slight) {
      return 'slight_improvement';
    } else if (changePercentage > -this.improvementThresholds.slight) {
      return 'stable';
    } else {
      return 'worsened';
    }
  }

  /**
   * Determine overall trend
   */
  determineTrend(progressHistory, currentScore) {
    if (progressHistory.length < 2) {
      return 'insufficient_data';
    }

    const scores = progressHistory
      .map(p => p.photo_analyses?.[0]?.overall_skin_score)
      .filter(score => score !== undefined);

    scores.push(currentScore);

    // Calculate trend using simple linear regression
    const trend = this.calculateLinearTrend(scores);

    if (trend > 0.5) return 'improving';
    if (trend < -0.5) return 'declining';
    return 'stable';
  }

  /**
   * Calculate linear trend
   */
  calculateLinearTrend(values) {
    const n = values.length;
    if (n < 2) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * Generate AI insights about progress
   */
  async generateProgressInsights(userId, weekNumber, improvements) {
    try {
      // Get user's routine adherence and product usage
      const adherenceData = await this.getRoutineAdherence(userId, weekNumber);
      
      const prompt = `Analyze the user's skincare progress and provide personalized insights.

PROGRESS DATA:
- Week: ${weekNumber}
- Overall Improvement: ${improvements.overall}%
- Skin Score Change: ${improvements.score_change} points
- Trend: ${improvements.trend}

CONCERN IMPROVEMENTS:
${JSON.stringify(improvements.concerns, null, 2)}

ROUTINE ADHERENCE:
- Adherence Rate: ${adherenceData.adherence_rate}%
- Missed Days: ${adherenceData.missed_days}
- Most Skipped Products: ${adherenceData.skipped_products.join(', ')}

Generate insights including:
1. Key achievements to celebrate
2. Areas showing most improvement
3. Concerns that need more attention
4. Routine optimization suggestions
5. Motivational message
6. Next steps recommendation

Return as JSON:
{
  "achievements": ["string"],
  "top_improvements": ["string"],
  "attention_areas": ["string"],
  "routine_suggestions": ["string"],
  "motivation": "string",
  "next_steps": ["string"],
  "milestone_reached": boolean,
  "personalized_tip": "string"
}`;

      const result = await models.flash.generateContent(prompt);
      const response = result.response.text();
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid AI response format');
      }

      return JSON.parse(jsonMatch[0]);

    } catch (error) {
      Logger.error('Generate progress insights error', { error: error.message });
      return this.getDefaultInsights();
    }
  }

  /**
   * Get routine adherence data
   */
  async getRoutineAdherence(userId, weekNumber) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weekNumber * 7));

    const { data, error } = await supabase
      .from('routine_tracking')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error || !data.length) {
      return {
        adherence_rate: 0,
        missed_days: 0,
        skipped_products: []
      };
    }

    const totalDays = weekNumber * 7;
    const trackedDays = data.length;
    const completedDays = data.filter(d => 
      d.morning_completed && d.evening_completed
    ).length;

    // Aggregate skipped products
    const skippedProducts = {};
    data.forEach(day => {
      (day.skipped_products || []).forEach(product => {
        skippedProducts[product] = (skippedProducts[product] || 0) + 1;
      });
    });

    const topSkipped = Object.entries(skippedProducts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([product]) => product);

    return {
      adherence_rate: Math.round((completedDays / totalDays) * 100),
      missed_days: totalDays - completedDays,
      skipped_products: topSkipped
    };
  }

  /**
   * Get default insights (fallback)
   */
  getDefaultInsights() {
    return {
      achievements: ['Consistent progress tracking'],
      top_improvements: ['Overall skin health'],
      attention_areas: ['Continue with your routine'],
      routine_suggestions: ['Maintain consistency'],
      motivation: 'Keep up the great work!',
      next_steps: ['Continue tracking progress'],
      milestone_reached: false,
      personalized_tip: 'Consistency is key to seeing results'
    };
  }

  /**
   * Generate progress report
   */
  async generateProgressReport(userId, period = 'monthly') {
    try {
      Logger.info('Generating progress report', { userId, period });

      // Get all progress data for the period
      const progressData = await this.getProgressDataForPeriod(userId, period);

      if (!progressData.length) {
        return {
          error: 'Insufficient data for report generation'
        };
      }

      // Analyze progress trends
      const analysis = await this.analyzeProgressTrends(progressData);

      // Generate visual data for charts
      const chartData = this.prepareChartData(progressData);

      // Generate AI summary
      const aiSummary = await this.generateAISummary(analysis, period);

      return {
        period: period,
        start_date: progressData[0].created_at,
        end_date: progressData[progressData.length - 1].created_at,
        total_entries: progressData.length,
        analysis: analysis,
        chart_data: chartData,
        ai_summary: aiSummary,
        recommendations: await this.generateReportRecommendations(analysis)
      };

    } catch (error) {
      Logger.error('Generate progress report error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get progress data for period
   */
  async getProgressDataForPeriod(userId, period) {
    const days = period === 'weekly' ? 7 : period === 'monthly' ? 30 : 90;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('user_progress')
      .select(`
        *,
        photo_analyses(*),
        photo_uploads(*)
      `)
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('week_number', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Analyze progress trends
   */
  analyzeProgressTrends(progressData) {
    const scores = progressData.map(p => ({
      week: p.week_number,
      score: p.photo_analyses?.[0]?.overall_skin_score || 0,
      date: p.created_at
    }));

    const concerns = {};
    progressData.forEach(p => {
      const improvements = p.concern_improvements || {};
      Object.entries(improvements).forEach(([concern, data]) => {
        if (!concerns[concern]) {
          concerns[concern] = [];
        }
        concerns[concern].push({
          week: p.week_number,
          improvement: data.improvement_percentage || 0
        });
      });
    });

    return {
      overall_trend: this.calculateLinearTrend(scores.map(s => s.score)),
      start_score: scores[0]?.score || 0,
      end_score: scores[scores.length - 1]?.score || 0,
      best_week: scores.reduce((best, current) => 
        current.score > best.score ? current : best
      ),
      concern_trends: concerns,
      consistency: this.calculateConsistency(progressData)
    };
  }

  /**
   * Calculate consistency score
   */
  calculateConsistency(progressData) {
    const weeks = progressData.map(p => p.week_number);
    const expectedWeeks = [];
    
    for (let i = weeks[0]; i <= weeks[weeks.length - 1]; i++) {
      expectedWeeks.push(i);
    }

    const consistency = (weeks.length / expectedWeeks.length) * 100;
    return Math.round(consistency);
  }

  /**
   * Prepare chart data for visualization
   */
  prepareChartData(progressData) {
    return {
      skin_score_timeline: progressData.map(p => ({
        week: p.week_number,
        date: new Date(p.created_at).toLocaleDateString(),
        score: p.photo_analyses?.[0]?.overall_skin_score || 0
      })),
      concern_progress: this.aggregateConcernProgress(progressData),
      adherence_timeline: progressData.map(p => ({
        week: p.week_number,
        adherence: p.routine_adherence || 0
      }))
    };
  }

  /**
   * Aggregate concern progress for charts
   */
  aggregateConcernProgress(progressData) {
    const concerns = {};

    progressData.forEach(p => {
      const improvements = p.concern_improvements || {};
      Object.entries(improvements).forEach(([concern, data]) => {
        if (!concerns[concern]) {
          concerns[concern] = {
            name: concern,
            data: []
          };
        }
        concerns[concern].data.push({
          week: p.week_number,
          improvement: data.improvement_percentage || 0
        });
      });
    });

    return Object.values(concerns);
  }

  /**
   * Generate AI summary for report
   */
  async generateAISummary(analysis, period) {
    const prompt = `Summarize the user's skincare progress for a ${period} report.

Analysis Data:
${JSON.stringify(analysis, null, 2)}

Provide an engaging, motivational summary that includes:
1. Overall progress assessment
2. Key achievements
3. Most improved areas
4. Areas needing attention
5. Consistency feedback

Keep it concise (3-4 sentences) and positive while being honest about areas for improvement.`;

    try {
      const result = await models.flash.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      return `Great progress over the past ${period}! Your skin health has shown consistent improvement. Keep up the excellent routine adherence for continued results.`;
    }
  }

  /**
   * Generate recommendations based on progress
   */
  async generateReportRecommendations(analysis) {
    const recommendations = [];

    // Score-based recommendations
    if (analysis.overall_trend < 0) {
      recommendations.push({
        type: 'routine_adjustment',
        priority: 'high',
        message: 'Consider reviewing your routine with our AI assistant for optimization'
      });
    }

    // Consistency recommendations
    if (analysis.consistency < 80) {
      recommendations.push({
        type: 'consistency',
        priority: 'medium',
        message: 'Try setting daily reminders to maintain routine consistency'
      });
    }

    // Concern-specific recommendations
    for (const [concern, trend] of Object.entries(analysis.concern_trends)) {
      const latestImprovement = trend[trend.length - 1]?.improvement || 0;
      if (latestImprovement < 10) {
        recommendations.push({
          type: 'targeted_treatment',
          priority: 'medium',
          concern: concern,
          message: `Consider adding targeted treatments for ${concern}`
        });
      }
    }

    return recommendations;
  }
}

module.exports = new BeautyProgressService();