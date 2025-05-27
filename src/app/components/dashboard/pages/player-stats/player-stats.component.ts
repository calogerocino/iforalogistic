import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { DiscordMessageService } from '../../../../services/discord-message.service';
import { DiscordMessage, DiscordEmbed } from '../../../../models/discord-message.model';
import { PlayerStat } from '../../../../models/player-stat.model';
import { CommonModule } from '@angular/common';

interface AggregatedStats {
  [playerName: string]: { totalKm: number; entryCount: number };
}

@Component({
  selector: 'app-player-stats',
  templateUrl: './player-stats.component.html',
  styleUrls: ['./player-stats.component.scss'],
  imports: [CommonModule],
})
export class PlayerStatsComponent implements OnInit, OnDestroy {
  playerStats: PlayerStat[] = [];
  isLoading: boolean = true;
  errorMessage: string | null = null;
  private messagesSubscription: Subscription | undefined;

  private readonly KM_KEYWORD = '[Reali]';

  constructor(private discordMessageService: DiscordMessageService) {}

  ngOnInit(): void {
    this.loadPlayerStats();
  }

  loadPlayerStats(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.messagesSubscription = this.discordMessageService.getMessages().subscribe({
      next: (messages: DiscordMessage[]) => {
        this.processMessages(messages);
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = 'Impossibile caricare le statistiche dei giocatori. Si prega di riprovare più tardi.';
        this.isLoading = false;
      }
    });
  }

  private processMessages(messages: DiscordMessage[]): void {
    const aggregatedData: AggregatedStats = {};

    messages.forEach((message) => {
      let basePlayerName: string | undefined;

      if (message.hasOwnProperty('authorTag') && (message as any).authorTag) {
        basePlayerName = (message as any).authorTag;
      } else if (message.authorId) {
        basePlayerName = `Utente (${message.authorId})`;
      }

      if (message.embeds && message.embeds.length > 0) {
        message.embeds.forEach((embed: DiscordEmbed) => {
          let finalPlayerName = basePlayerName;

          if (embed.author && embed.author.name && embed.author.name.trim() !== '') {
            finalPlayerName = embed.author.name.trim();
          }

          if (!finalPlayerName) {
            return;
          }

          if (embed.description) {
            const km = this.extractKmFromDescription(embed.description);
            if (km !== null) {
              if (!aggregatedData[finalPlayerName]) {
                aggregatedData[finalPlayerName] = { totalKm: 0, entryCount: 0 };
              }
              aggregatedData[finalPlayerName].totalKm += km;
              aggregatedData[finalPlayerName].entryCount += 1;
            }
          }
        });
      } else {
        // Se non ci sono embed, ma vuoi comunque registrare qualcosa basato su basePlayerName
        // (anche se improbabile per questo caso d'uso, dato che i KM sono negli embed)
        // Questa parte potrebbe non essere necessaria se i KM sono *sempre* negli embed.
        if (!basePlayerName) {
            return;
        }
        // Qui potresti decidere se fare qualcosa se il messaggio non ha embed
        // ma ha un basePlayerName. Per ora, dato che i km sono negli embed, non facciamo nulla.
      }
    });

    this.playerStats = Object.entries(aggregatedData)
      .map(([name, data]) => ({
        name: name,
        km: parseFloat(data.totalKm.toFixed(2)),
      }))
      .sort((a, b) => b.km - a.km);
  }

  private extractKmFromDescription(description: string): number | null {
    const keywordIndex = description.indexOf(this.KM_KEYWORD);
    if (keywordIndex === -1) {
      return null;
    }

    const textAfterKeyword = description.substring(keywordIndex + this.KM_KEYWORD.length);
    const match = textAfterKeyword.match(/[^\d]*([\d\s]+(\.\d+)?)/);

    if (match && match[1]) {
      const numberString = match[1].replace(/\s/g, '');
      const kmValue = parseFloat(numberString);
      return isNaN(kmValue) ? null : kmValue;
    }
    return null;
  }

  ngOnDestroy(): void {
    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe();
    }
  }
}
