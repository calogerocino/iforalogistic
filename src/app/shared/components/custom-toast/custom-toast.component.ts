import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { ToastService, ToastState } from '../../../services/toast.service';

@Component({
  selector: 'app-custom-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './custom-toast.component.html',
  styleUrls: ['./custom-toast.component.scss']
})
export class CustomToastComponent implements OnInit {
  public toastState$!: Observable<ToastState>;
  private toastService = inject(ToastService);

  ngOnInit(): void {
    this.toastState$ = this.toastService.toastState$;
  }

  closeToast() {
    this.toastService.hide();
  }
}
