import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ImageModalComponent } from './components/shared/image-modal/image-modal.component';
import { CustomToastComponent } from './shared/components/custom-toast/custom-toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ImageModalComponent, CustomToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'iforalogistic';
}
