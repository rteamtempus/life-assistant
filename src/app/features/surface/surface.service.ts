import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { ToolCategory } from '../../core/models';

export interface RankedTool {
  id: string;
  name: string;
  category: ToolCategory;
  is_energizing: boolean;
  uses: number;
  last_used: string | null;
}

export interface SurfaceResult {
  what_helped: string[];
  moments: { summary: string; similarity: number }[];
}

@Injectable({ providedIn: 'root' })
export class SurfaceService {
  private readonly supabase = inject(SupabaseService);

  /** History-based tool ranking — works today, no AI/secret needed (§9). */
  async rankedTools(count = 6): Promise<RankedTool[]> {
    const { data, error } = await this.supabase.client.rpc('top_tools', {
      match_count: count,
    });
    if (error) throw error;
    return (data ?? []) as RankedTool[];
  }

  /**
   * Semantic "what's worked when I felt like this" (§9). Needs the surface
   * Edge Function deployed + embedding key. Returns empty results rather than
   * throwing if it isn't available yet, so the screen still works.
   */
  async whatHelped(feeling: string): Promise<SurfaceResult> {
    try {
      const { data, error } = await this.supabase.invoke<SurfaceResult>(
        'surface',
        { feeling },
      );
      if (error) throw error;
      return data ?? { what_helped: [], moments: [] };
    } catch {
      return { what_helped: [], moments: [] };
    }
  }
}
