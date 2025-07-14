/**
 * Mappa che associa il nome del carico a un'icona di Font Awesome.
 * Le chiavi sono i nomi esatti dei carichi come appaiono nel gioco.
 * I valori sono le classi CSS di Font Awesome.
 */
export const CARGO_ICON_MAP: { [key: string]: string } = {
  // ADR / Prodotti Chimici e Pericolosi
  'Acido Solforico': 'fas fa-flask-vial',
  'Acido Idroclorico': 'fas fa-flask-vial',
  'Ammoniaca': 'fas fa-flask-vial',
  'Benzina': 'fas fa-fire-flame-simple',
  'Esplosivi': 'fas fa-bomb',
  'Fuochi d\'artificio': 'fas fa-bomb',
  'Gas': 'fas fa-fire',
  'Prodotti Chimici': 'fas fa-flask-vial',
  'Veleno': 'fas fa-biohazard',

  // Veicoli e Parti di Veicoli
  'Automobili Nuove': 'fas fa-car',
  'Automobili di Lusso': 'fas fa-car-side',
  'Trattori': 'fas fa-tractor',
  'Parti di automobili': 'fas fa-gears',
  'Pneumatici': 'fas fa-circle-dot',

  // Materiali da Costruzione
  'Mattoni': 'fas fa-trowel-bricks',
  'Cemento': 'fas fa-trowel-bricks',
  'Tubi di Cemento': 'fas fa-trowel-bricks',
  'Sabbia': 'fas fa-trowel-bricks',
  'Travi di Metallo': 'fas fa-industry',
  'Elementi Strutturali': 'fas fa-industry',
  'Escavatore': 'fas fa-tractor',
  'Muletto': 'fas fa-tractor',
  'Vetro': 'fas fa-martini-glass-empty', // Simboleggia la fragilità

  // Cibo e Bevande
  'Frutta e Verdura': 'fas fa-apple-whole',
  'Cibo in Scatola': 'fas fa-box',
  'Carne Congelata': 'fas fa-snowflake',
  'Gelato': 'fas fa-ice-cream',
  'Latte': 'fas fa-bottle-droplet',
  'Bestiame': 'fas fa-cow', // Animali vivi

  // Elettronica e Beni di Lusso
  'Elettronica': 'fas fa-microchip',
  'Computer': 'fas fa-laptop',
  'Mobili di Lusso': 'fas fa-couch',
  'Gioielli': 'fas fa-gem',

  // Materiali e Beni Generici
  'Legname': 'fas fa-tree',
  'Carta': 'fas fa-scroll',
  'Vestiti': 'fas fa-shirt',
  'Mobili': 'fas fa-couch',
  'Pacchi': 'fas fa-dolly',
  'Pallet Vuoti': 'fas fa-pallet',
  'Giocattoli': 'fas fa-shapes',
  'Fiori': 'fas fa-leaf',

  // Medicinali
  'Attrezzatura Medica': 'fas fa-kit-medical',
  'Vaccini': 'fas fa-syringe',
  'Medicinali': 'fas fa-pills'
};

/**
 * Icona di default per i carichi non presenti nella mappa.
 */
export const DEFAULT_CARGO_ICON = 'fas fa-box'; // Un'icona generica
