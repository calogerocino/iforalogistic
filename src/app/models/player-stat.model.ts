export interface PlayerStat {
  id?: string; // Opzionale, se Firestore assegna un ID specifico per la statistica aggregata
  name: string; // Nome del giocatore
  km: number;   // Km reali percorsi
  // entries?: number; // Opzionale: per tracciare il numero di viaggi/log
}
