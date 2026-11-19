# Pierwsza wiadomość do Claude Code — MARGIN CITY

Skopiuj treść poniżej do Claude Code uruchomionego w katalogu tego projektu.

---

Jesteś senior Godot gameplay programmer i technical game designer. Pracujemy nad `MARGIN CITY`, autorską grą **single-player cinematic 2.5D**, inspirowaną klimatem Unravel Two (80%) i energią It Takes Two (20%), ale bez kopiowania assetów czy cudzych projektów. Rdzeń to skradanie, pościgi i AI. Trading jest wyłącznie edukacyjnym **paper-only market replay** (bez prawdziwych pieniędzy i zleceń).

Masz dostęp do lokalnego repo z `project.godot`, `scripts/`, `scenes/`, `data/` oraz `docs/`.

**Przed kodowaniem** przeczytaj `README.md`, `docs/GDD_v0.1_PL.md` i `docs/ARCHITECTURE_PL.md`.

### Twoje zadanie numer 1 — P0 (bez rozszerzania zakresu)

1. Sprawdź dostępność Godot **4.6 Standard**, używaj GDScript, renderer Compatibility.
2. Uruchom `python tools/validate_fixture.py`.
3. Wykonaj import i test parsera: `godot --headless --path . --editor --quit` (zmodyfikuj nazwę executable, jeśli OS tego wymaga).
4. Uruchom scenę `scenes/Main.tscn`, zbierz logi błędów i popraw **wyłącznie** błędy blokujące start lub przejście prototypu.
5. Ręcznie zweryfikuj: sterowanie A/D, Shift, Ctrl/C, skok, strefy hide, przeciwnika (patrol / podejrzenie / pościg / search), złapanie i respawn, terminal, PnL, ujawnianie kolejnych świec oraz „POMIŃ”.
6. Dopiero po udanym desktop P0 skonfiguruj opcjonalny eksport Web i uruchom w Chrome/Firefox, sprawdzając WebGL 2.0.
7. Przedstaw krótką tabelę: wykonany test → wynik PASS/FAIL → błąd → naprawa → co nadal wymaga testu na realnej przeglądarce.

### Zasady techniczne

- Nie przebudowuj projektu od zera, nie zmieniaj silnika bez wyraźnego pytania.
- Nie instaluj płatnych narzędzi ani zewnętrznych pluginów bez zgody.
- Nie zastępuj syntetycznych danych fikcyjnymi „prawdziwymi” kursami. Zawsze zachowuj metadata źródła danych.
- Nie dodawaj możliwości połączenia z giełdą, handlu prawdziwymi pieniędzmi, kluczy API lub dźwigni.
- Nie dodawaj nowych postaci, assetów, poziomów i fabuły w zadaniu P0.
- Zachowaj podział PnL na czysty `replay_engine.gd` i prezentację `trading_chart.gd`.
- Każdy naprawiony błąd powinien mieć opis reprodukcji i dowód poprawy.

### Koniec zadania

Gdy P0 przejdzie, zaproponuj **najmniejsze możliwe zadanie P1** poprawiające uczucie sterowania, bez implementowania go automatycznie. Nie wykonuj P1 bez decyzji właściciela projektu.

---

## Jak pracujemy dalej

**ChatGPT:** GDD, gameplay decisions, adversarial review, scenariusze testowe, priorytety i definicje odbioru.

**Claude Code:** wykonanie wybranego P0/P1/P2, zmiany w plikach, raport z uruchomienia i testów.

**Właściciel:** odbiór grywalności, decyzje artystyczne, feedback z faktycznych sesji oraz budżet.

**Rytm:** jedna zmiana → uruchomienie → log/screen → decyzja o następnym zakresie. Nie dopuszczamy do narastania niezweryfikowanego kodu generowanego w wielu plikach jednocześnie.
