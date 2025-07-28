import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

import { roleGuard } from './guards/role.guard';

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
    loadComponent: () =>
      import(
        './components/public/public-homepage/public-homepage.component'
      ).then((m) => m.PublicHomepageComponent),
    title: 'Benvenuto su IFL',
  },
  {
    path: 'download',
    loadComponent: () =>
      import(
        './components/public/public-download/public-download.component'
      ).then((m) => m.PublicDownloadComponent),
    title: 'Download in corso',
  },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./components/auth/authpage/authpage.component').then(
            (m) => m.AuthPageComponent
          ),
        data: { isLoginMode: true, title: 'Accedi - IFL' },
        title: 'Accedi - IFL',
      },
      {
        path: 'registrazione',
        loadComponent: () =>
          import('./components/auth/authpage/authpage.component').then(
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
      import('./components/dashboard/layout/dashboardlayout.component').then(
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
        path: 'datahub',
        loadComponent: () =>
          import('./components/dashboard/pages/datahub/datahub.component').then(
            (m) => m.PlayerDatahubComponent
          ),
        title: 'Player Datahub',
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
        path: 'users',
        loadComponent: () =>
          import(
            './components/dashboard/pages/users/users-list.component'
          ).then((m) => m.UsersListComponent),
        title: 'Lista utenti - IFL',
        canActivate: [roleGuard(['Admin'])],
      },
      {
        path: 'eventi',
        children: [
          {
            path: '',
            loadComponent: () =>
              import(
                './components/dashboard/pages/events/event-list/event-list.component'
              ).then((m) => m.EventListComponent),
            title: 'Lista Eventi - IFL',
            canActivate: [roleGuard(['Admin'])],
          },
          {
            path: 'nuovo',
            loadComponent: () =>
              import(
                './components/dashboard/pages/events/event-manage/event-manage.component'
              ).then((m) => m.EventManageComponent), // Assumendo un nuovo componente
            title: 'Crea Evento - IFL',
            canActivate: [roleGuard(['Admin'])],
          },
          {
            path: 'modifica/:id',
            loadComponent: () =>
              import(
                './components/dashboard/pages/events/event-manage/event-manage.component'
              ).then((m) => m.EventManageComponent), // Stesso componente
            title: 'Modifica Evento - IFL',
            canActivate: [roleGuard(['Admin'])],
          },
          {
            path: ':id',
            loadComponent: () =>
              import(
                './components/dashboard/pages/events/event-manage/event-manage.component'
              ).then((m) => m.EventManageComponent), // Stesso componente
            title: 'Dettaglio Evento - IFL',
            canActivate: [roleGuard(['Admin'])],
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'auth/login' },
];
