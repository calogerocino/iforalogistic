import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { DiscordMessageService } from '../../../../services/discord-message.service';
import { DiscordMessage } from '../../../../models/discord-message.model';
import { CommonModule } from '@angular/common';
import { FileSizePipe } from '../../../../pipe/file-size.pipe';

@Component({
  selector: 'app-discord-messages',
  standalone: true,
  imports: [
    CommonModule,
    FileSizePipe,
  ],
  templateUrl: './discord-messages.component.html',
  styleUrls: ['./discord-messages.component.scss']
})
export class DiscordMessagesComponent implements OnInit {
  discordMessages$!: Observable<DiscordMessage[]>;

  constructor(private discordMessageService: DiscordMessageService) { }

  ngOnInit(): void {
    this.discordMessages$ = this.discordMessageService.getMessages();
  }
}
