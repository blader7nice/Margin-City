# Changelog — Margin City: The Last Signal

## M04 — 23.11.2026 (gałąź `claude/wonderful-meitner-zopq4u`)

Punkt powrotu M03: commit `6667f14` (lokalny tag `milestone-03`; serwer odrzuca wysyłanie tagów).

### Ukończone (grywalne, przetestowane)
- **Market Replay 2.0:**
  - 12 sytuacji rynkowych z ID `rodzina-seed`, model rynku 2.0, przyszłość bez z góry ustalonego wyniku;
  - analiza kontekstu tylko z widocznych świec;
  - ocena procesu z progami (teza bez pokrycia nie dostanie A mimo zysku), wynik i komentarz osobno;
  - 200 alternatywnych przyszłości po odsłonięciu;
  - zarządzanie pozycją (SL/TP w trakcie, BE, zamknięcie), wielkość wg ryzyka %;
  - zoom i przesuwanie wykresu, MA20/MA50, legenda OHLCV, skalowany tekst.
- **Fabuła a trening:** sesja Dave'a i nagranie raz na przejście; potem symulator. Trening także z menu i przez `?replay=<ID>`; lokalna historia sesji.
- **Kanon I-1 w grze:**
  - otwarcie z automatyczną wiadomością Dave'a (Dead Man's Switch, wskazówka „biblioteka / trzecia droga”) i ostrzeżeniem „K.” o likwidacji o 06:00;
  - cel misji i komunikat MM-01 o likwidacji;
  - sejf zamyka protokół likwidacji, nie MIRROR (zgodność z ograniczeniem 5).
- **Czytelność:**
  - HUD i menu skalowane z rozdzielczością (rem);
  - lampy robocze pod kładką archiwum;
  - mocniejsze doświetlenie postaci w ciemności.
  - Z M03: pionowe kadrowanie zagrożenia w pościgu.
- **Dokumentacja:**
  - Master Bible v1.2 (I-1…I-5 ZATWIERDZONE, v1.1 zachowana);
  - Story Bible v1.0;
  - CLAUDE.md, README_START_HERE;
  - Market Replay 2.0, procedura playtestu, pipeline AI.
- **Testy:** 72 jednostkowe (w tym look-ahead, niezmienność oceny procesu względem przyszłości, strażnicy kanonu) i e2e w przeglądarce (fabuła, ponowne otwarcie = trening, trening z menu, karta końcowa).

### Prototyp (działa, wymaga decyzji lub danych)
- **Pipeline postaci z AI:**
  - `tools/blender/conform_character.py` dopasowuje dowolny GLB/OBJ/FBX do naszego szkieletu, wag i klipów;
  - przetestowany na modelu zastępczym udającym wynik AI;
  - podgląd A/B: `?leonModel=`;
  - **test płatnego narzędzia (Tripo Pro, ok. $20) czeka na zgodę.**
- Prognoza MIRROR — oficjalna mechanika (I-2), dalej w obecnej formie; rozwój etapowy po playtestach.

### Plan (nie zaczęte)
- Model Leona z AI (po zgodzie), potem Dave, Kate, MM-01.
- Animacje z Mixamo przeniesione na nasz szkielet (darmowe, wymaga konta Adobe właściciela).
- Playtest 3–5 osób według `docs/production/PLAYTEST_PROCEDURE.md`.
- Dane historyczne z potwierdzoną licencją (zamiast syntetycznych).

## M03 — 20.11.2026
- Terminal B-12 / Market Replay 1.0; Leon v2 i MM-01 v1 (Blender); narzędzia playtestu; pionowe kadrowanie zagrożenia. Punkt powrotu M02: `cdda2bf`.
