import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { CheckIn } from '../../core/models';

@Injectable({ providedIn: 'root' })
export class CheckInService {
  private readonly supabase = inject(SupabaseService);

  async save(
    fields: Pick<CheckIn, 'mood' | 'energy' | 'activation' | 'note'>,
  ): Promise<void> {
    const { error } = await this.supabase.client
      .from('check_ins')
      .insert(fields);
    if (error) throw error;
  }
}
