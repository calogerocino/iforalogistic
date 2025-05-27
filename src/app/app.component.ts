import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ImageModalComponent } from './components/shared/image-modal/image-modal.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ImageModalComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'iforalogistic';
}
