# MARGIN CITY — GAME DESIGN DOCUMENT v0.1

**Status:** zatwierdzony kierunek + robocze decyzje produkcyjne. **Data:** 2026-11-09.

## 0. Jednozdaniowa obietnica

„Przejdź przez piękne, niepokojące miasto, przechytrzaj polujących na ciebie przeciwników i poznawaj mechanizmy rynku — bez ryzykowania prawdziwych pieniędzy”.

## 1. Decyzje zatwierdzone przez twórcę

- **Single-player**, kampania narracyjna podzielona na misje, później rankingi i wydarzenia.
- **Cinematic 2.5D**: rzeczywisty świat 3D, ruch głównie w płaszczyźnie X/Y, wyreżyserowane zmiany kąta kamery.
- Art direction: **80% nastroju Unravel Two / 20% energii It Takes Two** (wyłącznie inspiracje, bez kopiowania postaci, poziomów, assetów czy identyfikacji wizualnej).
- Bohater: stylizowany młody człowiek w monumentalnym świecie.
- Historia: osobiste zobowiązania rodzinne + surrealistyczna metropolia finansowa.
- Core: skradanie, pościgi, inteligentni przeciwnicy (ważniejsze niż walka i kombosy).
- Nastrój: piękna, niepokojąca baśń z elementami thrillera/horroru.
- Trading: wyłącznie fikcyjne środki; docelowo odtwarzanie autentycznych historycznych danych dla krypto i wybranych instrumentów giełdowych.
- Start bez budżetu, wykonanie solo z pomocą ChatGPT i Claude Code; web-first, potem aplikacje mobilne.

## 2. Hipoteza produktowa

Gracz pozostanie w kampanii dla emocji związanych z ryzykiem wykrycia, pościgiem i odkrywaną fabułą. System tradingowy powinien wzmacniać ciekawość świata i uczyć jakości decyzji, ale **nie może** być przymusowym „egzaminem z kierunku ceny”.

**Test usuwania funkcji:** bez ekranu tradingowego 10-minutowa sekwencja stealth/chase nadal musi działać jako gra. Jeśli nie działa, naprawiamy core, nie rozwijamy wykresów.

## 3. Bohater — propozycja, nie decyzja ostateczna

**Elias**, około 20–23 lat, stylizowany człowiek o charakterystycznej, czytelnej sylwetce: płaszcz, torba, miękkie proporcje, naturalne animacje. Wyrusza, aby pomóc rodzinie. Jego **chęć** to zdobyć pieniądze szybko; jego **potrzeba** to nauczyć się osądu, cierpliwości i niezależności. Początkowo unika konfrontacji; jego siłą stają się obserwacja i adaptacja.

Nie zaczynamy od fotorealistycznego modelu. W v0.1 jest bryłą kontrolowaną w przestrzeni.

## 4. Świat i konflikt — propozycja

Margin City to spektakularne miasto, w którym prawo dostępu do przestrzeni, informacji i usług materializuje się w surrealistycznych obiektach. Instytucje i korporacje mają własne interesy; postacie-antagoniści ucieleśniają kontrolę, manipulację, panikę i chciwość. Nie dzielimy postaci na „dobrych crypto” i „złych regulatorów”: bardziej wiarygodna jest satyra na **zachowania**, a nie proste opowiedzenie się po stronie jednej grupy.

### Zarys kampanii (hipoteza fabularna)

1. **Zero Balance:** przyjazd do miasta, pierwszy list od rodziny, utrata orientacji, pierwsza kryjówka.
2. **Trading Floor:** stara hala finansowa, Inspektor, terminal, pierwsza decyzja rynkowa.
3. **Liquidity Trap:** labirynt kanałów, przeciwnicy reagujący na dźwięk, fałszywe wskazówki i ograniczony czas.
4. **The Regulators:** archiwum pozwoleń i gigantyczne mechaniczne urządzenia; satyra na arbitralne blokady dostępu.
5. **Margin Call:** odkrycie, że rynek można manipulować także pod sztandarem „wolności”; finał moralny, nie tylko finansowy.

**Nie produkujemy 5 rozdziałów.** To rama do przyszłego pisania; wykonujemy tylko jeden fragment greybox.

## 5. Mechaniki core

### 5.1 Ruch

Ruch po osi X, skok po Y, sprint, przykucnięcie, ukrywanie się; Z jest zablokowane w pierwszym prototypie. Zmiana osi, schodów czy ruchu w głąb wymaga osobnych odcinków levelu; nie pozwalamy kamerze samej tworzyć nieczytelnego sterowania.

### 5.2 Stealth

- Strefa widzenia zależna od kierunku spojrzenia i dystansu; docelowo także od światła i geometrii.
- Bieg generuje odgłos, który zwiększa zainteresowanie Inspektora.
- Crouch zmniejsza zasięg rozpoznania, a w strefie kryjówki ukrywa całkowicie (uproszczenie na czas greybox).
- Utracony kontakt wzrokowy => **Search** przy ostatniej znanej pozycji, bez telepatycznego śledzenia gracza.
- Po złapaniu restartujemy krótki fragment, nie cofamy całości fabuły.

### 5.3 Przeciwnik — Inspektor

**Stany:** PATROL → SUSPICIOUS → CHASE → SEARCH → RETURN. Priorytet: czytelny feedback i możliwość przechytrzenia, nie brutalna szybkość. Wersja greybox ma jeden AI, bez pathfindingu pełnego 3D. W przyszłości: dźwięki/animacje ostrzegawcze, wskaźnik podejrzenia, przewidywalne momenty reakcji, testowalna pamięć ostatniego miejsca widzenia.

### 5.4 Kamera

3D kamera w ujęciu boczno-ukośnym, śledzenie postaci z lekkim opóźnieniem i „look ahead”. Reżyserowane strefy zmieniają wysokość/odległość. **W czasie pościgu priorytetem jest widoczność przeszkód** — kamera nie może chować miejsca lądowania.

### 5.5 Trading

Terminal jest częścią świata fabularnego. Przed decyzją gracz widzi wyłącznie historię do punktu wejścia. Wybiera **LONG / SHORT / POMIŃ**. Po decyzji ujawniają się następne świece i wynik. W docelowym systemie dochodzą wielkość pozycji, stop-loss, prowizje, slippage, opcjonalna nagroda za poprawne zarządzanie ryzykiem oraz obiektywna ocena decyzji (nie sam PnL).

Przestrzegamy zasad: brak pieniędzy rzeczywistych, brak zleceń na giełdzie, brak kont i kluczy API, brak agresywnej monetyzacji bazującej na losowych wynikach, brak reward loop promującego ekstremalną dźwignię. Gracz musi móc **nie handlować** i kontynuować kampanię.

## 6. Pętla pojedynczej misji

**Uwaga / eksploracja** → **zidentyfikuj wzorzec patrolu** → **skrzyżowanie ryzyka (przebiec, schować się, odwrócić uwagę)** → **pościg lub bezpieczne przejście** → **odblokuj przejście i wskazówkę** → **opcjonalne wydarzenie rynkowe** → **wynik i dalsza fabuła**.

Docelowy fragment vertical slice: 10–15 min. Wersja techniczna v0.1: krótszy korytarz testowy, służący jedynie do walidacji sterowania, AI i terminala.

## 7. Pierwsza scena: „THE LAST SHIFT”

Sceneria: nocna, monumentalna hala giełdowa. Na pierwszym planie filary, w tle wielkie gmachy. Elias pojawia się po lewej, terminal znajduje się daleko po prawej.

Sekwencja nauki bez tutorialowego zalewu tekstu:

1. Przeszkoda: gracz używa skoku.
2. Pierwsza zielona kryjówka: uczy się przykucnięcia.
3. Inspektor patroluje środek mapy; obserwacja i ukrycie są lepsze niż sprint.
4. Jeśli zostanie wykryty, zaczyna się pościg.
5. Bezpiecznie dociera do terminala, otwiera replay, wybiera działanie, widzi wynik i zamyka terminal.

Warunek sukcesu: ukończony replay (także „POMIŃ”). Warunek porażki lokalnej: Inspektor łapie gracza -> respawn. Po zmianie sceny żadne zdarzenie z terminala nie powinno zwiększać prawdziwych sald ani otwierać zewnętrznych linków giełdowych.

## 8. Ocena jakości prototypu — decyzje go/no-go

- [ ] Nowy gracz przechodzi fragment bez tłumaczenia sterowania przez twórcę.
- [ ] Zauważa, kiedy Inspektor się nim interesuje, zanim nastąpi schwytanie.
- [ ] Po zgubieniu przeciwnika potrafi przewidzieć, co AI zrobi dalej.
- [ ] Potrafi wymienić co najmniej jeden interesujący wybór między ukryciem i sprintem.
- [ ] Trading nie przerywa wymuszenie sceny akcji — terminal jest bezpieczny.
- [ ] Wynik replay jest deterministyczny i zgodny z zasadami opłat.
- [ ] Zmiana ujęcia kamery nie utrudnia odczytywania miejsca lądowania.
- [ ] Projekt działa poprawnie po eksporcie WebGL 2.0 na docelowej przeglądarce.

Jeśli 3 pierwsze punkty są niespełnione, nie inwestujemy w art i kolejne misje.

## 9. Zasady wyróżnienia i własności intelektualnej

Unravel Two, It Takes Two i Intruders to **referencje**, nie zasoby do kopiowania. Unikamy przejmowania imion, sylwetek, postaci, lokacji, audio i dialogów. Antagoniści to fikcyjne figury pokazujące zachowania i konflikty interesów, a nie literalne modele twarzy prawdziwych osób.

## 10. Otwarte decyzje (po playteście)

- Czy Elias zostaje główną postacią oraz czy jego historia rodzinna jest osią kampanii?
- Czy finał pokazuje świat bardziej baśniowy czy thrillerowy?
- Czy trading ma być rzadką mechaniką narracyjną czy regularnym opcjonalnym wyzwaniem?
- Czy ranking opiera się o czas, liczbę wykryć i poziom wiedzy czy PnL? Rekomendacja: **nie ranking PnL bez normalizacji ryzyka**.
- Czy i kiedy kamera pozwoli przechodzić między głębiami, nie tylko X/Y?
