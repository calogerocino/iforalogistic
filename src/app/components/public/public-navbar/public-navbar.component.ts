import { Component } from '@angular/core';
import { RouterModule } from '@angular/router'; // Importa se il logo o il menu avranno link

@Component({
  selector: 'app-public-navbar',
  standalone: true,
  imports: [RouterModule], // Aggiungi RouterModule se necessario
  templateUrl: './public-navbar.component.html',
  styleUrls: ['./public-navbar.component.scss']
})
export class PublicNavbarComponent {
  // Logica futura per il menu, se necessario
}
