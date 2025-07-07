import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastState {
  show: boolean;
  message: string;
  type: ToastType;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastState = new BehaviorSubject<ToastState>({
    show: false,
    message: '',
    type: 'info'
  });

  public toastState$: Observable<ToastState> = this.toastState.asObservable();

  private hideTimer: any;

  constructor() { }


  show(message: string, type: ToastType = 'success', duration: number = 4000) {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }

    this.toastState.next({ show: true, message, type });

    this.hideTimer = setTimeout(() => {
      this.hide();
    }, duration);
  }

  hide() {
    this.toastState.next({ ...this.toastState.value, show: false });
  }
}
