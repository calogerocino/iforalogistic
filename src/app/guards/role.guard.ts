import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

type UserRole = 'Admin' | 'Eventmanager' | 'User' | 'Nuovo';

export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return (): Observable<boolean | UrlTree> => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.currentUser$.pipe(
      take(1),
      map(user => {
        if (user && user.role && allowedRoles.includes(user.role as UserRole)) {
          return true;
        }
        console.warn(`Accesso negato. L'utente non ha uno dei seguenti ruoli richiesti: ${allowedRoles.join(', ')}`);
        return router.createUrlTree(['/dashboard']);
      })
    );
  };
};
