import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  // {
  //   path: '',
  //   loadComponent: () =>
  //     import(
  //       './components/public/under-construction/under-construction.component'
  //     ).then((m) => m.UnderConstructionComponent),
  //   title: 'Sito in Allestimento',
  // },
    {
    path: '',
    loadComponent: () => import('./components/public/public-homepage/public-homepage.component').then(m => m.PublicHomepageComponent),
    title: 'Benvenuto su IFL'
  },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./components/auth/auth-page/auth-page.component').then(
            (m) => m.AuthPageComponent
          ),
        data: { isLoginMode: true, title: 'Accedi - IFL' },
        title: 'Accedi - IFL',
      },
      {
        path: 'registrazione',
        loadComponent: () =>
          import('./components/auth/auth-page/auth-page.component').then(
            (m) => m.AuthPageComponent
          ),
        data: { isLoginMode: false, title: 'Registrati - IFL' },
        title: 'Registrati - IFL',
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./components/dashboard/layout/dashboard-layout.component').then(
        (m) => m.DashboardLayoutComponent
      ),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import(
            './components/dashboard/pages/dashboard-home/dashboard-home.component'
          ).then((m) => m.DashboardHomeComponent),
        title: 'Dashboard Home',
      },
      {
        path: 'profilo',
        loadComponent: () =>
          import(
            './components/dashboard/pages/user-profile/user-profile.component'
          ).then((m) => m.UserProfileComponent),
        title: 'Il Mio Profilo',
      },
       {
        path: 'discord',
        loadComponent: () =>
          import(
            './components/dashboard/pages/discord-messages/discord-messages.component'
          ).then((m) => m.DiscordMessagesComponent),
        title: 'Messaggi Discord',
      },
      {

          path: 'player-stats',
        loadComponent: () =>
          import(
            './components/dashboard/pages/player-stats/player-stats.component'
          ).then((m) => m.PlayerStatsComponent),
        title: 'Statistiche Giocatori',
      },
          {
        path: 'eventi',
        children: [
          {
            path: '',
            loadComponent: () => import('./components/dashboard/pages/events/event-list/event-list.component').then(m => m.EventListComponent),
            title: 'Lista Eventi - IFL'
          },
          {
            path: 'nuovo',
            loadComponent: () => import('./components/dashboard/pages/events/event-manage/event-manage.component').then(m => m.EventManageComponent), // Assumendo un nuovo componente
            title: 'Crea Evento - IFL'
          },
          {
            path: 'modifica/:id',
            loadComponent: () => import('./components/dashboard/pages/events/event-manage/event-manage.component').then(m => m.EventManageComponent), // Stesso componente
            title: 'Modifica Evento - IFL'
          },
          {
            path: ':id',
            loadComponent: () => import('./components/dashboard/pages/events/event-manage/event-manage.component').then(m => m.EventManageComponent), // Stesso componente
            title: 'Dettaglio Evento - IFL'
          }
        ]
      }
    ],
  },
  { path: '**', redirectTo: 'auth/login' },
];
