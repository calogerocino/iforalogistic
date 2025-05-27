import { Component, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { ImageModalService } from '../../../services/image-modal.service';

@Component({
  selector: 'app-image-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-modal.component.html',
  styleUrls: ['./image-modal.component.scss'],
})
export class ImageModalComponent {
  isOpen$: Observable<boolean>;
  imageUrl$: Observable<string | null>;

  private imageModalService = inject(ImageModalService);

  constructor() {
    this.isOpen$ = this.imageModalService.isOpen$;
    this.imageUrl$ = this.imageModalService.imageUrl$;
  }

  close(): void {
    this.imageModalService.closeModal();
  }

  // Chiudi il modale con il tasto Escape
  @HostListener('document:keydown.escape', ['$event'])
  onKeydownHandler(event: KeyboardEvent) {
    this.isOpen$
      .subscribe((isOpen) => {
        // Controlla lo stato corrente
        if (isOpen) {
          this.close();
        }
      })
      .unsubscribe(); // Unsubscribe subito dopo per evitare memory leak
  }
}
