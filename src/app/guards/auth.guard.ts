// auth.guard.ts

import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (
  route,
  state
): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    take(1),
    map((user) => {
      if (user) {
        if (
          user.role === 'Admin' ||
          user.role === 'User' ||
          user.role === 'Eventmanager'
        ) {
          return true;
        } else if (user.role === 'Nuovo') {
          authService.logout();
          return router.createUrlTree(['/auth/login'], {
            queryParams: { reason: 'unauthorized' },
          });
        }
      }

      return router.createUrlTree(['/auth/login']);
    })
  );
};
