export interface Projekt {
  id: string;
  nazwa: string;
  opis: string;
}

export interface Uzytkownik {
  id: string;
  imie: string;
  nazwisko: string;
}

export interface Historyjka {
  id: string;
  nazwa: string;
  opis: string;
  priorytet: 'niski' | 'średni' | 'wysoki';
  projektId: string;
  dataUtworzenia: string;
  stan: 'todo' | 'doing' | 'done';
  wlascicielId: string;
}
