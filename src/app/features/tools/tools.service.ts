import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { Tool, ToolCategory } from '../../core/models';

@Injectable({ providedIn: 'root' })
export class ToolsService {
  private readonly supabase = inject(SupabaseService);

  async list(): Promise<Tool[]> {
    const { data, error } = await this.supabase.client
      .from('tools')
      .select('*')
      .eq('archived', false)
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Tool[];
  }

  /** Log that a tool was used. "Presence, never absence" (§1.1) — this only
   *  ever records doing, never a miss. */
  async logUse(toolId: string, note?: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('tool_uses')
      .insert({ tool_id: toolId, note: note ?? null });
    if (error) throw error;
  }

  async add(
    name: string,
    category: ToolCategory,
    isEnergizing: boolean,
    description?: string,
  ): Promise<Tool> {
    const { data, error } = await this.supabase.client
      .from('tools')
      .insert({
        name,
        category,
        is_energizing: isEnergizing,
        description: description ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Tool;
  }
}
