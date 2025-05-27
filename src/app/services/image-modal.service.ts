import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ImageModalService {
  private isOpenSubject = new BehaviorSubject<boolean>(false);
  isOpen$: Observable<boolean> = this.isOpenSubject.asObservable();

  private imageUrlSubject = new BehaviorSubject<string | null>(null);
  imageUrl$: Observable<string | null> = this.imageUrlSubject.asObservable();
  imageModalService: any;

  constructor() { }

  openModal(imageUrl: string): void {
    if (imageUrl) {
      this.imageUrlSubject.next(imageUrl);
      this.isOpenSubject.next(true);
    }
  }

  closeModal(): void {
    this.isOpenSubject.next(false);
    this.imageUrlSubject.next(null);
  }
}
