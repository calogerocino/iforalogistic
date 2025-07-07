import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DownloadService } from '../../../services/download.service';

@Component({
  selector: 'app-public-download',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './public-download.component.html',
  styleUrls: ['./public-download.component.scss']
})
export class PublicDownloadComponent implements OnInit {
  downloadUrl: string | null = null;
  errorMessage: string | null = null;

  private downloadService = inject(DownloadService);

  ngOnInit(): void {
    this.downloadService.getDownloadUrl().subscribe({
      next: (url) => {
        if (url) {
          this.downloadUrl = url;
          window.location.href = url;
        } else {
          this.errorMessage = 'URL per il download non trovato.';
        }
      },
      error: (err) => {
        this.errorMessage = 'Errore nel recupero del link per il download.';
        console.error(err);
      }
    });
  }
}
