import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { DiscordMessageService } from '../../../../services/discord-message.service';
import { DiscordMessage } from '../../../../models/discord-message.model';
import { CommonModule } from '@angular/common'; // Importa CommonModule

@Component({
  selector: 'app-discord-messages',
  standalone: true, // Assumendo che sia standalone
  imports: [
    CommonModule // Aggiungi CommonModule per DatePipe, NgIf, NgFor, AsyncPipe
  ],
  templateUrl: './discord-messages.component.html',
  styleUrls: ['./discord-messages.component.scss']
})
export class DiscordMessagesComponent implements OnInit {
  discordMessages$!: Observable<DiscordMessage[]>; // Aggiungi '!' per l'asserzione di non null

  constructor(private discordMessageService: DiscordMessageService) { }

  ngOnInit(): void {
    this.discordMessages$ = this.discordMessageService.getMessages();
  }
}
