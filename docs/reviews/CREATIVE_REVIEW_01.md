# MARGIN CITY: THE LAST SIGNAL — CREATIVE REVIEW 01

**Autor:** Claude Code (Narrative Director / Senior Game Designer / Technical Director)
**Podstawa:** `MARGIN_CITY_MASTER_BIBLE_v1.0_PL.md`, `CLAUDE_CREATIVE_REVIEW_01_PL.md`
**Data:** 19.11.2026
**Status:** przegląd kreatywny. Żadna propozycja nie jest kanonem bez zgody twórcy.

Oznaczenia: **[ZATWIERDZONE]** — fakt z biblii. **[PROPOZYCJA CLAUDE]** — moja propozycja do decyzji.

> **Uwaga o audycie repo:** repozytorium `Margin-City` jest w chwili przeglądu **puste** (brak commitów, brak projektu Godot, brak `docs/`). Starego greyboxa nie dało się więc obejrzeć. Wnioski techniczne w sekcji H opieram na biblii i na znanych ograniczeniach eksportu webowego Godot 4.x. Trzeba je potwierdzić na prawdziwym prototypie.

---

## Najkrótsze podsumowanie

Fundament jest dobry: braterska stawka, prolog oparty na „trzeciej drodze” i uczciwy Market Replay to rzadkie i sympatyczne połączenie. Największe ryzyko nie leży w pomysłach. Leży w trzech lukach, które później wymuszą przepisywanie scen:

1. **PROJECT MIRROR nie ma zdefiniowanych granic.** Bez nich antagonista staje się wszechmocny, a każdy twist wygląda na magię.
2. **Łańcuch wskazówek (Dave → B-12 → „K.”) jest niespójny czasowo.** Gracz od razu zapyta: „czemu nie policja, czemu nie media?”.
3. **Cel wizualny („80% Unravel Two”) koliduje z rendererem webowym Godota i z produkcją solo.**

Moja główna propozycja to **jeden pomysł, który spina wszystkie trzy filary**. MIRROR przewiduje zachowanie tłumu, a nie jednostki. Strażnicy działają według jego prognozy, którą gracz widzi. Leon wygrywa, wybierając „trzecią drogę”, której model nie przewiduje. Dave jako jedyny nie umiał przewidzieć Leona. Szczegóły w sekcji E.

---

## A. Kanon w 12 zdaniach

1. Gracz steruje **Leonem (23 lata)**, młodszym bratem, który przyjeżdża do Margin City, żeby odnaleźć zaginionego brata.
2. **Dave (33 lata, zarost)** to starszy brat: niewinny analityk i projektant części systemu **PROJECT MIRROR**, porwany po tym, jak odkrył nadużycia.
3. Dave stworzył model analizy zachowań i psychologii inwestorów do uprawnionych celów. Nie wiedział o jego przestępczym wykorzystaniu, nie jest ukrytym mastermindem i nie steruje wydarzeniami z niewoli.
4. Przed porwaniem Dave przygotował tropy: dziennik powiązany z historycznymi wykresami, identyfikatory archiwów, odniesienia do wspólnych wspomnień i nagrania.
5. **Kate (31 lat, długie kręcone blond włosy, kobieca torebka z narzędziami)** jest partnerką Dave'a i pracownicą korporacji. Pod przykrywką okazjonalnie pomaga Leonowi, ryzykując dekonspirację, i sama nie zna całej prawdy.
6. **Marcus Maker** to główny antagonista, który nadzoruje nadużywanie MIRROR. Normalny market making nie jest przedstawiany jako przestępstwo.
7. **MM-01** to podległy Marcusowi Inspektor: wysoki, w grafitowym płaszczu, z twarzą pół-ludzką i pół-cybernetyczną (implanty przy oku, skroni i szczęce, bez pełnego hełmu). Działa w stanach Patrol → Suspicion → Chase → Search → Return i nigdy nie widzi przez ściany.
8. Prolog **„The Third Way”** to wspomnienie sprzed 15 lat w bibliotece-labiryncie. 8-letni Leon i 18-letni Dave rozwiązują zagadki w książkach, ukrywają się przed surową, ale niegroźną bibliotekarką, a Leon dostaje mosiężny kompas.
9. Pierwsza misja **„The Last Shift”** prowadzi przez nocny kompleks finansowy do Terminala B-12: pierwsze starcie z MM-01, jedna bezpieczna sesja Market Replay, nagranie Dave'a i trop do The Paper District.
10. Leon dostaje anonimowy kontakt podpisany „K.” oraz wcześniejszy trop od Dave'a. Tożsamość „K.” nie jest ujawniana od razu, a żadna wiadomość nie jest „magicznie” wysyłana po porwaniu.
11. Market Replay działa wyłącznie na wirtualnych środkach i jawnie opisanych danych. Nie pokazuje przyszłości przed decyzją, SKIP jest pełnoprawny, a fabuła nigdy nie zależy od PnL.
12. Gra jest single-player, cinematic 2.5D, web-first. Leon uwalnia Dave'a, obaj przeżywają, a z pomocą Kate ujawniają proceder i publicznie uczą o psychologii rynku, nie obiecując przewidywania cen.

---

## B. Red flags — 10 najważniejszych (od najwyższego ryzyka)

### 1. MIRROR bez granic = wszechmocny antagonista
- **Problem:** biblia mówi, *czym* MIRROR jest tematycznie, ale nie mówi, *czego nie potrafi*. Bez tego każde rozwiązanie fabularne („MIRROR to wykrył”, „MIRROR przewidział”) staje się tanim deus ex machina. Mechanika stealth też nie ma ram: co Inspektor „wie” od systemu?
- **Przykład sceny:** w M08 MM-01 mówi „Subject identity pending”. Skoro MIRROR jest tak potężny, dlaczego nie zna Leona? A skoro go nie zna, czemu w rozdziale 2 nagle wie wszystko?
- **Konsekwencja dla gracza:** poczucie, że autor oszukuje, oraz porażki w stealth, których nie da się zrozumieć.
- **Rozwiązanie [PROPOZYCJA CLAUDE]:** zapisać w biblii **6 twardych ograniczeń MIRROR** (sekcja F) i zasadę gameplayową: *wszystko, co MM-01 wie od MIRROR, gracz też widzi* (sekcja E).
- **Koszt:** S (dokumentacja), a zapobiega przepisywaniu L.

### 2. Łańcuch wskazówek: dwie wiadomości, policja, media
- **Problem:** Leon ma „trop od Dave'a” i wiadomość od „K.”. Nie wiadomo, jak trop Dave'a dotarł, dlaczego akurat teraz i dlaczego Dave zamiast dowodów zostawił zagadki. Gracz zada też dwa pytania w pierwszych minutach: *„Czemu Leon nie idzie na policję?”* i *„Czemu Dave nie wysłał dowodów dziennikarzom?”*.
- **Przykład:** P06, pociąg. Jeśli Leon jedzie z dwoma tropami i bez wyjaśnienia, misja 01 startuje na fabularnym kredycie.
- **Konsekwencja:** zagadki wyglądają na sztuczne („po co Dave bawi się w szyfry, skoro chodzi o jego życie?”).
- **Rozwiązanie [PROPOZYCJA CLAUDE]:**
  - **Dead man's switch:** Dave co 14 dni potwierdzał prostą zaplanowaną usługę. Gdy przestał, do Leona poszła krótka wiadomość bez dowodów, zrozumiała tylko dla niego: *„Pamiętasz trzecią drogę? B-12.”*
  - **Policja:** oficjalnie Dave „złożył wypowiedzenie i wyjechał odpocząć” (mail wysłany z jego konta). Dorosły, który odchodzi z własnej woli, to dla policji nie sprawa.
  - **Media:** Dave **nie miał pełnych dowodów**, tylko fragmenty. Wyniki MIRROR wyglądają jak zwykła analityka. Dowodem jest dopiero powiązanie prognoz z konkretnymi kampaniami informacyjnymi i zleceniami, a ich ślady leżą w wewnętrznych systemach. Z fragmentami prawnicy korporacji zdusiliby sprawę, a Dave zniknąłby na nic. **Gra polega więc na składaniu dowodu**, nie na odnajdywaniu gotowego pendrive'a.
  - **Wiadomość „K.” to impuls, nie pierwszy trop:** Leon od tygodni ma niezrozumiałe „B-12”. Kate pisze: *„Jutro tego miejsca już nie będzie. Dziś w nocy albo nigdy. — K.”* (patrz red flag 4).
- **Koszt:** S. Zmienia głównie dialogi P06 i M07.

### 3. Cel wizualny vs. renderer webowy i produkcja solo
- **Problem:** „80% Unravel Two” oznacza bardzo bogate światło, głębię ostrości, materiały, mgłę wolumetryczną i dopracowaną animację. Według mojej wiedzy eksport webowy Godot 4.x działa **tylko z rendererem Compatibility (WebGL 2)**: bez SDFGI/VoxelGI, bez wolumetrycznej mgły i z ograniczonym post-processingiem. *Trzeba to potwierdzić w audycie na 4.7.2, bo może się to zmienić w nowszych wersjach.*
- **Przykład:** P01 („szeroki kadr na wysokie półki, złote światło”) zaprojektowany w Forward+ wyglądałby świetnie w edytorze i płasko w przeglądarce.
- **Konsekwencja:** ryzyko przerobienia całej oprawy po kilku miesiącach albo gry, która nie działa płynnie na laptopie ze zintegrowaną grafiką.
- **Rozwiązanie [PROPOZYCJA CLAUDE]:** od pierwszego dnia pracować w rendererze Compatibility. Przenieść nastrój z efektów na **stylizację „dioramy”**: mocne sylwetki, warstwy planów (foreground cards), wypalone lub malowane światło, kolor jako narracja (bursztyn = pamięć, cyjan = MIRROR) i fake fog na kartach. Unravel Two traktować jako odniesienie dla *emocji i skali bohatera*, nie dla technologii.
- **Koszt:** S teraz, L jeśli odłożymy.

### 4. „The Last Shift”: po co strażnik w opuszczonym budynku i dlaczego dziś?
- **Problem:** kompleks jest „nieczynny”, a patroluje go elitarny Inspektor. Brakuje powodu, dla którego Leon wchodzi akurat tej nocy, i brakuje zegara.
- **Przykład:** M02. Gracz się zastanawia, co MM-01 tu w ogóle robi.
- **Konsekwencja:** świat wygląda na zbudowany pod gracza, a nie istniejący sam w sobie.
- **Rozwiązanie [PROPOZYCJA CLAUDE] — „Noc przed czystką”:** kompleks to dawny parkiet i archiwum sprzed migracji MIRROR do nowej infrastruktury. Marcus podejrzewa, że Dave mógł coś ukryć w starych, niepodłączonych systemach. Nie musi tego znaleźć: **zleca ich zniszczenie** (wymazanie serwerów, niszczarki dokumentów), a MM-01 nadzoruje likwidację. Tytuł „The Last Shift” zyskuje dosłowne znaczenie (ostatnia zmiana przed likwidacją). Kate wie o harmonogramie, bo widzi kalendarze operacyjne (sekcja F), więc to ona pisze „dziś albo nigdy”. To racjonalne zachowanie antagonisty, a nie wszechwiedza.
- **Koszt:** S (narracja) + S/M (tablica harmonogramu i sektory gasnące kolejno jako element rozgrywki).

### 5. Ukryty koszt postaci i animacji
- **Problem:** pierwsze ~30 minut wymaga **sześciu unikalnych postaci**: Leon-dziecko, Dave-nastolatek, bibliotekarka, Leon dorosły, MM-01 z mimiką w zbliżeniu oraz Dave na nagraniu. Do tego zestawy animacji (stealth, skok, ślizg, pościg) i facial MM-01. Dla solo devu to najdroższy element projektu.
- **Przykład:** M02, „bliskie ujęcie częściowo ludzkiej twarzy”. Mimika w zbliżeniu to najdroższa rzecz w grafice 3D.
- **Konsekwencja:** albo wieczna produkcja, albo tanio wyglądające kluczowe sceny.
- **Rozwiązanie [PROPOZYCJA CLAUDE]:**
  - Jeden wspólny rig humanoida i stylizacja z mocną sylwetką, z twarzami bez szczegółowej mimiki.
  - Zbliżenie MM-01 robione „filmowo-tanio”: wolny najazd, statyczna twarz, ruch jedynie implantu przy oku (światło lub przysłona) i jedno mrugnięcie. Mniej to tu więcej.
  - Nagranie Dave'a jako **audio + ziarniste, statyczne kadry z kamery terminala**, nie w pełni animowana scena.
  - Bibliotekarka może być w większości sylwetką, światłem lampy i dźwiękiem kroków.
- **Koszt:** wdrożenie zasady S, oszczędność L.

### 6. Stealth w 2.5D: czytelność głębi i widzenia
- **Problem:** w kamerze bocznej „schowanie się za regałem” oznacza ruch w głąb, czyli na oś, którą gracz słabo widzi. Stożki widzenia w 2.5D łatwo stają się niejednoznaczne.
- **Przykład:** P04. Gracz kuca „za” regałem, a bibliotekarka go widzi, bo kolizja była płytsza, niż wyglądała.
- **Konsekwencja:** poczucie niesprawiedliwości, czyli najgorsza możliwa rzecz w stealth.
- **Rozwiązanie [PROPOZYCJA CLAUDE]:**
  - Ukrycie jako **dyskretny stan** (strefa kryjówki z wyraźnym wejściem), a nie zgadywanie fizyki.
  - Wspólny język wizualny: Leon w ukryciu ciemnieje lub dostaje lekki kontur.
  - Widzenie przeciwnika jako **światło diegetyczne** (lampa bibliotekarki, iluminator oka MM-01) zamiast UI-stożka.
  - Przejścia między płaszczyznami tylko w autorskich punktach, bez swobodnego ruchu w osi Z.
  - Debug overlay percepcji od pierwszego greyboxa.
- **Koszt:** M.

### 7. Market Replay bez stawki, z ryzykiem prawnym
- **Problem A — stawka:** skoro archiwum otwiera się „niezależnie od PnL”, gracz może uznać replay za minigrę do przeklikania.
- **Problem B — prawo i kanon:** jeśli fikcyjna manipulacja MIRROR zostanie przypięta do **prawdziwego historycznego ruchu ceny** (np. „ten krach z dnia X był sterowany”), łamiemy zasadę „nie każde wydarzenie to manipulacja” i ryzykujemy zarzut sugerowania faktów o realnym rynku.
- **Problem C — dane:** dane z giełd kryptowalut zwykle mają regulaminy ograniczające komercyjną redystrybucję. Do sprawdzenia przed jakąkolwiek publiczną wersją. Na prototyp wystarczą dane syntetyczne z etykietą.
- **Rozwiązanie [PROPOZYCJA CLAUDE]:**
  - Data replayu jest **osobista**, nie spiskowa: np. „dzień, w którym zacząłem pracę w firmie”. Dave zostawił własny *dziennik decyzji z tamtego dnia* (gdzie się bał, gdzie zrobił SKIP). Gracz porównuje swój proces z procesem brata. To lekcja, nie oskarżenie rynku.
  - Stawką jest **kalibracja**, nie PnL: patrz „Twoja prognoza” w sekcji E.
  - Wskazówka fabularna wynika z *obserwacji* (np. komentarz Dave'a do konkretnej świecy), ale nigdy z trafienia kierunku.
- **Koszt:** M.

### 8. Kate: przykrywka bez fundamentu
- **Problem:** biblia zostawia otwarte, czy korporacja zna jej związek z Dave'em. W firmie, która zbudowała system nadzoru, „nie wiedzą” jest niewiarygodne, a „wiedzą” wymaga wyjaśnienia, czemu ją tolerują.
- **Konsekwencja:** każda scena z Kate w rozdziałach 2–6 będzie budowana na piasku.
- **Rozwiązanie [PROPOZYCJA CLAUDE]:** korporacja **wie**. Kate dostała oficjalną wersję („Dave się wypalił i odszedł”). Marcus trzyma ją blisko jako *przynętę*, licząc, że Dave się do niej odezwie. Kate o tym wie, dlatego pomaga rzadko, analogowo i krótko. Szczegóły w sekcji F.
- **Koszt:** S.

### 9. Konflikt braci jest niezdefiniowany
- **Problem:** „ostatni kontakt był napięty” to tylko zapowiedź konfliktu. M07 („przeprasza za ewentualne napięcia”) brzmi przez to ogólnikowo. Brak konkretu uniemożliwia też pisanie pojednania w rozdziałach 5–6.
- **Rozwiązanie [PROPOZYCJA CLAUDE]:** kilka tygodni przed zniknięciem Leon poprosił Dave'a o pomoc w ważnej dla siebie sprawie (np. rzucił studia i chciał pogadać), a Dave go zbył, chłodno i obco. Leon wziął to za dowód, że „brat z korporacji” przestał się nim interesować. **Prawda (ujawniona późno):** Dave już wtedy prowadził prywatne śledztwo i celowo odsunął Leona, żeby go nie wciągać. To nie obciąża Dave'a moralnie i daje mocny moment w finale: „Odepchnąłem cię, bo jesteś jedynym, kogo nie mogli przewidzieć”.
- **Koszt:** S. Zapobiega przepisywaniu M07 i rozdziału 5.

### 10. Tempo pierwszych minut w przeglądarce
- **Problem:** 7–9 minut ciepłego wspomnienia, zanim pojawi się jakiekolwiek zagrożenie, plus tytuł dopiero w 9. minucie. W webie gracz decyduje w 1–3 minuty, czy zostaje. *To szacunek, nie dane; trzeba sprawdzić w playtestach.*
- **Rozwiązanie [PROPOZYCJA CLAUDE]:** 30–45-sekundowy **cold open**: dorosły Leon w ciemnej hali B-12, kroki MM-01, Leon ściska kompas, cięcie na złote światło biblioteki („15 lat wcześniej”). Prolog skrócić do ok. 6 minut, a stawkę gracz zna od pierwszej sekundy. Alternatywa bez cold openu: wpleść w prolog jeden krótki „przeskok” pamięci.
- **Koszt:** S/M (jedna dodatkowa scena, ale w lokacji, którą i tak budujemy).

### Luki, które później wymuszą przepisywanie scen
- **„MM-01 to Dave?”** Gracze *na pewno* to zasugerują (pół-człowiek, zaginiony brat). Kanon to wyklucza, więc trzeba to szybko i wyraźnie zamknąć (inny wzrost, brak zarostu, inny głos) albo świadomie zagrać tym podejrzeniem przez jedną scenę. Nie zostawiać tego przypadkowi.
- **Gdzie fizycznie jest Dave?** Drowned Vault w rozdziale 5 musi być zasygnalizowany wcześniej (np. w M01: zatopione podziemia na planach budynku).
- **„Marcus Maker / MM-01” to czytelna gra słów z „market maker”.** W baśniowej konwencji może działać, ale wzmacnia ryzyko odczytania gry jako oskarżenia całej branży. Biblia już to zastrzega. Rekomenduję zostawić imię, lecz dać Marcusowi w rozdziale 1 jedną linię, która oddziela go od branży (np. o „zwykłych market makerach, którzy tylko dają płynność”).
- **Smart Money / Whale:** słusznie zamrożone. Nie rozbudowywać przed vertical slice.

---

## C. Trzy warianty mocniejszego prologu „The Third Way”

Wszystkie respektują kanon: biblioteka, Leon 8 lat, Dave 18 lat, zagadki w książkach, bibliotekarka niegroźna, kompas na koniec.

### Wariant C1 — „Zgadnę, co zrobisz” *(rekomendowany jako szkielet)*
- **Hook:** Dave przy wejściu: „Zakład. Zgadnę każdy twój ruch. Jeśli choć raz się pomylę, dostaniesz prezent”. Leon chce wygrać, więc gracz od razu ma cel i motywację.
- **Zagadka z książkami:** w ulubionej książce Leona (np. atlasie latarni, pokazanej w P01) leży karta biblioteczna z trzema symbolami. Symbole odpowiadają znakom na grzbietach w dwóch korytarzach. W obu książkach na końcu trasy Leon znajduje **liścik Dave'a: „Wiedziałem, że tu zajrzysz :)”**. Obie oczywiste drogi zostały przewidziane. Trzecia (drabina na antresolę, widoczna, jeśli gracz spojrzy w górę) jest jedyną bez liściku. Rozwiązanie wynika z obserwacji, nie z losowego klikania.
- **Ukrywanie przed bibliotekarką:** bibliotekarka zawsze sprawdza **miejsca, gdzie zwykle chowają się dzieci**. Są widoczne w świecie jako wytarty dywan na jej trasie, zostawione zabawki i odsunięte krzesła. Dave szepcze: „Ona wie, gdzie chowają się dzieci. Nie wie, gdzie schowasz się ty”. Leon chowa się w nieoczywistym miejscu (wózek z książkami, szczyt drabiny). To ten sam język, którego użyje MM-01 (sekcja E).
- **Dialog braterski (przykład):**
  - Leon: „Skąd wiedziałeś, że pójdę w lewo?”
  - Dave: „Bo wszyscy idą w lewo. Ludzie są przewidywalni, kiedy się spieszą”.
  - Leon: „Ja nie jestem wszyscy”.
  - Dave (uśmiech): „No to mi to udowodnij”.
- **Kamera:** szerokie ujęcia na „góry” regałów. Przy zagadce delikatny tilt w górę, który pokazuje antresolę, ale nie drabinę. Przy bibliotekarce kamera lekko obniża się do perspektywy dziecka.
- **Emocjonalne zakończenie:** Dave odbiera Leona przy czytelni: „Przegrałem zakład”. Wręcza kompas: „Nie zawsze pokaże ci drogę. Ale przypomni, żebyś szukał własnej”. I ciszej: „Jesteś jedynym człowiekiem, którego nie umiem przewidzieć”. Ta linia zostaje zasiana w prologu i wraca w finale kampanii.

### Wariant C2 — „Ostatnie popołudnie przed wyjazdem”
- **Hook:** Dave (18) za kilka dni wyjeżdża na studia. Leon jest obrażony i nie chce iść. Dave wabi go tajemnicą: „Zostawiłem ci coś. Ale musisz to znaleźć sam”.
- **Zagadka:** mapa biblioteki podarta na trzy kawałki i ukryta w trzech książkach. Każdy kawałek pokazuje inną część labiryntu. Dopiero złożone ujawniają trzecie przejście.
- **Ukrywanie:** bibliotekarka reaguje na kłótnię braci. Konflikt emocjonalny wprost generuje hałas, a hałas generuje zagrożenie (świetne połączenie systemu z historią).
- **Dialog:** Leon: „Po co mi kompas, jak ciebie nie będzie?” Dave: „Właśnie po to”.
- **Kamera:** pierwsza połowa w ciasnych, nieco chłodnych kadrach (obraza Leona). Po pogodzeniu się kadry stopniowo otwierają się i robi się cieplej.
- **Zakończenie:** kompas „żebyś zawsze znalazł drogę do mnie”. Mocno ustawia 15 lat oddalenia i sens całej wyprawy.
- **Ryzyko:** bardziej melodramatyczny. Najlepiej działa jako **rama** dla C1, nie osobny wariant.

### Wariant C3 — „Ostatni obchód”
- **Hook:** bracia zostają w bibliotece po zamknięciu (Dave to zaplanował). Bibliotekarka robi ostatni obchód z lampą.
- **Zagadka:** cienie. Globus i rzeźbione regały rzucają w świetle lampy wzór, który wskazuje półkę. Gracz musi *poczekać na przejście bibliotekarki*, żeby zobaczyć wskazówkę. Stealth i zagadka są tu jednym zadaniem.
- **Ukrywanie:** lampa jest jedynym „stożkiem widzenia”. Uczy dokładnie tego języka, którego użyjemy przy MM-01 (światło = widzenie).
- **Dialog:** przy oknie Dave pokazuje nocną panoramę dzielnicy finansowej: „Kiedyś będę tam pracował. Będę rozumiał, czemu ludzie robią to, co robią”. Niewinne marzenie, które dorosły Leon usłyszy z goryczą.
- **Kamera:** półmrok, bursztynowa lampa, długie cienie.
- **Zakończenie:** kompas przy oknie, z miastem w tle. Match cut na to samo miasto widziane z pociągu.
- **Ryzyko:** nocna biblioteka przesuwa ton w stronę grozy, więc trzeba pilnować humoru bibliotekarki.

**Rekomendacja:** **C1 jako mechanika + rama emocjonalna C2** (wyjazd Dave'a jako tło) + **jeden moment z C3** (okno z widokiem na miasto). Ta wersja daje grze najmocniejszy kręgosłup tematyczny.

---

## D. Trzy warianty lepszego „The Last Shift”

### Wariant D1 — „Noc przed czystką” *(rekomendowany jako logika i struktura)*
- **Pierwszy kontakt z MM-01:** Leon z galerii widzi przez szkło, jak MM-01 **przeszukuje szafę archiwalną**, z której korzystał Dave. Inspektor szuka tego samego co Leon i jeszcze nie wie o jego obecności. Bliskie ujęcie twarzy, potem szeroki kadr. Pierwsza linia: „Unregistered movement detected” pada, gdy Leon potrąci coś na galerii, czyli po konkretnym bodźcu.
- **Wybór stealth (Silent Hall):** (1) lady kasowe, (2) strefa serwisowa, (3) odwrócenie uwagi dźwiękiem, oraz **(4) trzecia droga dla uważnych**: tablica harmonogramu likwidacji pokazuje, że sektory hali gasną po kolei co ok. 40 s. Gaśnięcie świateł jest ruchomą osłoną, którą można przewidzieć.
- **Pościg:** alarm z Broken Passage (sygnalizowany zawczasu). Ucieczka przez halę niszczarek (taśmy, zrzucane palety dokumentów). MM-01 nie jest szybszy od Leona: **odcina drogę** (zamyka bramy, skraca łuk), więc pościg to gra w przewidywanie, a nie wyścig. Koniec: Leon zamyka grodzie archiwum.
- **B-12:** archiwum za grodzią jest bezpiecznym pokojem (gwarancja safe room z kanonu). Wymazanie B-12 jest zaplanowane na koniec harmonogramu, więc gracz ma spokój bez sztucznego pauzowania zegara.
- **Cliffhanger:** gdy Leon wychodzi z kopią dziennika, zaczyna się wymazanie. MM-01 za szkłem nie goni, tylko patrzy. Podnosi z podłogi coś, co Leon zgubił w pościgu (np. bilet z pociągu). „Archive breach confirmed. Subject identity pending”. Na zewnątrz telefon Leona: „K.: Nie wracaj do hotelu”.

### Wariant D2 — „Lustro” (mechanika prognozy w centrum)
- **Pierwszy kontakt:** MM-01 nie patroluje. **Stoi i czeka** w miejscu, gdzie MIRROR przewiduje wejście intruza, a podłogowe paski cyjanu pokazują „korytarz prognozy”. Gracz widzi go z góry, zanim zostanie zauważony. To uczciwe wprowadzenie mechaniki sygnaturowej.
- **Wybór stealth:** każda trasa ma widoczny „poziom prognozy”. Trasy przewidziane są łatwe i pilnowane, nieprzewidziane trudniejsze ruchowo (platforming, zagadka), ale ciche.
- **Pościg:** MIRROR zamyka drzwi **na przewidywanej trasie ucieczki**. Gracz musi skręcić w tunel techniczny, którego prognoza nie obejmuje.
- **B-12:** replay z osobistą datą Dave'a i jego dziennikiem decyzji. Lekcja: „model daje prawdopodobieństwo, nie przyszłość”.
- **Cliffhanger [mocny]:** na ekranie MIRROR za szkłem buduje profil intruza: *„Subject identity pending. Behavioral match: D. [nazwisko] — 0.71”*. MIRROR rozpoznaje Leona **po tym, że porusza się jak Dave**, bo Dave go tego nauczył. To pokazuje, jak Marcus dowie się o bracie (wnioskowanie, a nie wszechwiedza), i zarazem jest emocjonalnym ciosem.

### Wariant D3 — „Kate na zmianie”
- **Pierwszy kontakt:** MM-01 eskortuje elegancką kobietę z torebką przez halę. Leon podsłuchuje: „Pani partner zrezygnował, prawda? Nie odzywał się?”. Ekspozycja wychodzi naturalnie, a Kate jest pod presją. Leon słabo zna Kate (oddalenie braci), więc nie wie, że to „K.”.
- **Wybór stealth:** rozmowa Kate z MM-01 **maskuje hałas**, co daje trzecią drogę dla tych, którzy wykorzystają ten moment.
- **Pościg:** klasyczny, jak w D1.
- **B-12:** grodzie były wcześniej odblokowane kartą Kate. To nieplanowana konsekwencja jej pomocy, zgodnie z kanonem.
- **Cliffhanger:** MM-01 sprawdza log dostępu: „Badge K. — 02:14”. Zbliżenie na torebkę Kate.
- **Ryzyko:** zbyt wcześnie podpowiada, kim jest „K.”, wymaga gotowego modelu Kate w misji 1 i zwiększa liczbę postaci. **Zostawić na rozdział 2.**

**Rekomendacja:** **struktura i logika D1 + mechanika i cliffhanger „Behavioral match” z D2.** D3 przenieść do Paper District.

---

## E. Signature mechanic: „PROGNOZA” (Trzecia Droga)

### Idea w jednym zdaniu [PROPOZYCJA CLAUDE]
**MIRROR przewiduje, którędy pójdzie „typowy” intruz, ochrona działa według tej prognozy, a gracz ją widzi. Leon wygrywa, wybierając drogę, której model nie przewidział, a system uczy się na jego nawykach.**

### Dlaczego to coś więcej niż efekt wizualny
To jedna reguła obecna jednocześnie w trzech filarach:
- **Stealth:** prognoza to *jawna informacja* o tym, gdzie przeciwnik będzie patrzył. Daje decyzję (łatwo, ale pilnowane, czy trudno, ale cicho), a nie tylko kolorową podłogę.
- **Historia braci:** Dave jako dziecko grał z Leonem w „zgadnę, co zrobisz”. Jako dorosły zbudował model przewidywania tłumu, pierwotnie po to, by **wykrywać paniki i chronić klientów**. Marcus odwrócił lustro: zamiast wykrywać panikę, prognozy służą do jej wywoływania. Leon jest *jedynym człowiekiem, którego Dave nie umiał przewidzieć*, i dlatego w finale odnajduje Dave'a tam, gdzie MIRROR daje 0%.
- **Trading:** Market Replay uczy dokładnie tej samej lekcji: prognoza to rozkład prawdopodobieństwa, nie przyszłość. Liczy się zarządzanie ryzykiem na wypadek pomyłki, a SKIP jest decyzją.

### Jak działa — w bibliotece (analogowo)
- Bibliotekarka ma „prognozę” zrobioną z nawyku: **wytarty dywan** na jej stałej trasie i **typowe dziecięce kryjówki** (pod stołem, za zasłoną), które zawsze sprawdza.
- Dave uczy to czytać: „Ona wie, gdzie chowają się dzieci. Nie wie, gdzie schowasz się ty”.
- Zero technologii i zero UI. Gracz uczy się języka, nie wiedząc, że to tutorial.

### Jak działa — w The Last Shift (cyfrowo)
- Ten sam język wizualny w innej skórze: **zimne cyjanowe paski w podłodze/suficie** pokazują „korytarze prognozy” (wytarty dywan → świecący korytarz). Panele ścienne mogą pokazywać procent.
- **MM-01 w Patrol** pilnuje tras o wysokiej prognozie. **W Search** najpierw sprawdza *ostatnią znaną pozycję* (kanon), a potem *hotspoty prognozy*. To uczciwe, bo gracz widzi oba.
- **Pościg:** system zamyka bramy na przewidywanej trasie ucieczki.
- **Twarda zasada fairness:** *wszystko, co MM-01 wie od MIRROR, gracz też widzi.* Żadnych ukrytych bonusów percepcji.

### Market Replay: „Twoja prognoza”
- Przed decyzją LONG/SHORT/SKIP gracz zaznacza na osi ceny **przedział**, w którym jego zdaniem znajdzie się cena za N świec, i swoją pewność (np. 50/70/90%).
- Po ujawnieniu gra pokazuje, czy cena wypadła w przedziale. W kolejnych sesjach śledzi **kalibrację** („mówiłeś 90%, trafiałeś w 55% przypadków”).
- To bezpośrednio uczy o nadmiernej pewności siebie i nie wymaga układania świec pod fabułę. Jest też lustrem MIRROR: *gracz sam staje się modelem i widzi, jak często się myli.*

### Wersja pełna vs. MVP
| | Pełna | **MVP (rekomendowana)** |
|---|---|---|
| Prognoza | Adaptacyjna: liczniki typów tras użytych przez gracza (szyby, góra, dół, dystrakcja) podnoszą wagę tych tras w kolejnych strefach | **Statyczna, autorska** dla każdej strefy (designer rysuje korytarze) |
| Uczenie się | Ciągłe, per strefa | **Jeden skryptowany moment:** trasa użyta przez gracza w M03 jest „zaobserwowana” i pilnowana w M08 (komunikat MM-01: „Pattern logged”) |
| AI | Waga prognozy w Patrol i Search | Search: ostatnia znana pozycja → 1–2 hotspoty prognozy |
| Replay | Kalibracja w wielu sesjach | Jedna sesja z przedziałem i pewnością + omówienie |
| Koszt | L | **S/M** |

---

## F. Stress-test logiczny

### Dlaczego korporacja przetrzymuje Dave'a żywego
- **Fakt [ZATWIERDZONE/ROBOCZE]:** potrzebują jego wiedzy o krytycznym elemencie MIRROR i chcą odzyskać ukryte dowody.
- **Propozycja [PROPOZYCJA CLAUDE] — trzy powody naraz, żaden nie jest wszechmocą:**
  1. **Ubezpieczenie:** korporacja wie z logów, że Dave coś wyniósł, ale nie wie, ile kopii istnieje ani czy jego śmierć czegoś nie uruchomi. Dave mógł to zasugerować (blef lub prawda). Zabicie go to ryzyko.
  2. **Dryf modelu:** rdzeń „detektora paniki”, który zaprojektował Dave, traci trafność, gdy rynek zmienia reżim. Marcus potrzebuje rekalibracji przed dużą operacją (zalążek „The Golden Parade”: kampania euforii/FOMO), co daje naturalny zegar kampanii.
  3. **Charakter Marcusa:** racjonalizator, który wierzy, że Dave'a da się „przekonać”. Dave pod przymusem gra na zwłokę i podaje subtelnie błędne kalibracje. To bierny opór, a nie współwina i nie sterowanie Leonem.

### Dlaczego Kate może działać pod przykrywką
- **Fakt:** partnerka Dave'a, pracownica, częściowy dostęp, podwójne życie, niepełna wiedza.
- **Propozycja:** Kate pracuje w **dziale compliance / kontroli wewnętrznej**. Ironia: to ona powinna wykryć nadużycia, a jest od nich odcięta. Ma dostęp do logów, kalendarzy operacyjnych i harmonogramów likwidacji (stąd wie o „nocy przed czystką”), ale **nie** do rdzenia MIRROR. Korporacja **zna** jej związek z Dave'em i trzyma ją blisko jako przynętę. Kate to wie, dlatego kontaktuje się rzadko i analogowo. Torebka pełna analogowych narzędzi (klucze, karty, papier, notes) wynika z logiki: Kate omija cyfrowy nadzór.

### Co Kate zrobiła przed porwaniem i po nim
- **Przed:** Dave mówił jej niewiele, żeby ją chronić. Widziała jego strach i usłyszała jedno zdanie: „Jeśli coś się stanie, znajdź Leona”.
- **Po:** dostała „wypowiedzenie” Dave'a mailem i od razu wiedziała, że to fałszywka, bo Dave nigdy się tak nie podpisywał. *Ludzki detal, którego nie złapała maszyna*, to ten sam temat co cała gra. Pisze do Leona z jednorazowego numeru jako „K.”, bo Leon słabo ją zna (oddalenie braci), a ona nie może być widziana w kontakcie z rodziną Dave'a.

### Jak działa archiwum ze wskazówkami
- **Dead man's switch** (wiadomość do Leona po 14 dniach braku potwierdzenia): tylko krótki osobisty szyfr, bez dowodów.
- **Kryjówki w infrastrukturze offline/legacy:** MIRROR indeksuje żywe systemy, a stare, odłączone archiwa są jego ślepą plamką.
- **Klucze z pamięci:** hasła to odpowiedzi ze wspólnego dzieciństwa (np. tytuł książki z prologu). MIRROR modeluje tłum, nie prywatne wspomnienie dwóch osób.
- **Zasada pisania nagrań Dave'a („test warunkowy”):** każde nagranie mówi wyłącznie o przeszłości lub w trybie warunkowym („Jeśli to oglądasz, to znaczy, że nie odezwałem się przez dwa tygodnie”). Nigdy nie wspomina wydarzeń po swoim zniknięciu ani przyszłych działań Kate.

### Dlaczego Marcus nie namierzył tropów wcześniej
- Tropy są offline i zaszyfrowane osobistymi kluczami, a Marcus szukał śladów cyfrowych.
- Marcus **nie musi ich znaleźć**: wystarczy zniszczyć stare archiwa (czystka). To tanie, racjonalne i daje The Last Shift zegar.
- O Leonie dowiaduje się dopiero przez wnioskowanie („Behavioral match”), czyli w sposób, który gracz rozumie.

### Ograniczenia PROJECT MIRROR [PROPOZYCJA CLAUDE — do wpisania w biblię]
1. **Modeluje zbiorowości, słabo jednostki.** Przewiduje tłum, nie konkretnego człowieka.
2. **Jest ślepy offline.** Bez danych na żywo nic nie widzi (papier, stare archiwa, rozmowa twarzą w twarz).
3. **Daje prawdopodobieństwa, często się myli,** zwłaszcza przy zmianie reżimu rynku. Wymaga kalibracji.
4. **Sam nie porusza rynkiem.** Nadużycie wymaga ludzi, którzy prowadzą kampanie informacyjne i składają zlecenia. Zostają po nich ślady papierowe i cyfrowe, a to jest dowód, który bracia mogą zabezpieczyć.
5. **Ochrona fizyczna (prognoza dla MM-01) to wtórne zastosowanie,** z tymi samymi ograniczeniami.
6. **Nie czyta myśli i nie widzi przez ściany.** Zna tylko to, co zarejestrowały czujniki.

---

## G. Ranking TOP 5 proponowanych zmian

Oceny są jakościowe, nie pomiarowe.

| # | Zmiana | Emocje | Gameplay | Oryginalność | Koszt | Ryzyko web | Zależności | Rekomendacja |
|---|---|---|---|---|---|---|---|---|
| 1 | **„Prognoza” — signature mechanic (MVP statyczny)** | 3 | 5 | 4 | M | Niskie | AI state machine, język światła, level design stref | **Tak, w greyboxie** |
| 2 | **Logika B-12: dead man's switch + „Noc przed czystką” + „K.” jako impuls** | 4 | 3 | 3 | S | Niskie | Status Kate (decyzja I-3) | **Tak, aktualizacja biblii** |
| 3 | **Konflikt braci: Dave odsunął Leona, by go chronić + cliffhanger „Behavioral match”** | 5 | 1 | 4 | S | Niskie | Dialog P05/M07, linia „nie umiem cię przewidzieć” | **Tak** |
| 4 | **Biblioteka z prologu wraca w The Paper District** (Dave ukrył dziennik w miejscu z dzieciństwa; ta sama przestrzeń po 15 latach, zamknięta, zakurzona, wieczorem) | 5 | 3 | 4 | S/M (*oszczędza* assety) | Średnie (duże wnętrze) | Wariant prologu, art direction | **Tak, bardzo wysoki zwrot** |
| 5 | **Replay „Twoja prognoza” (przedział + pewność → kalibracja)** | 2 | 3 | 4 | M | Niskie | UI replay, dane syntetyczne | **Tak, w Quality Slice** |

Komentarz do #4: to najlepszy stosunek emocji do kosztu w całym raporcie. Gracz rozpozna miejsce, w którym był szczęśliwy, a teraz jest tam sam i ścigany. Produkcyjnie to ponowne użycie modułów środowiska z innym światłem.

---

## H. Plan Creative Gate → Greybox

### Stan wyjściowy (audyt)
- **Repozytorium jest puste.** Stary prototyp Godot nie jest wersjonowany, więc nie da się go audytować ani bezpiecznie rozwijać. To pierwszy problem do rozwiązania (krok 0).
- Biblia: prototyp działa w edytorze 4.7.2, dokumentacja v0.1 mówiła 4.6. Wersja nie jest zamrożona.

### Dwa warianty techniczne (bez automatycznej zmiany silnika)
- **Wariant T1 — kontynuacja starego prototypu** na wersji, w której działa (4.7.2), po audycie: renderer, export web, jakość kodu AI. Wybrać, jeśli prototyp ma sensowny kontroler postaci i AI.
- **Wariant T2 — czysty projekt greybox na tej samej wersji silnika**, z przeniesieniem tylko *koncepcji* (state machine AI, ustawienia kamery). Wybrać, jeśli audyt pokaże, że prototyp był budowany pod Forward+ albo ma splątaną architekturę.
- **W obu wariantach:** renderer **Compatibility od pierwszego dnia** i eksport web testowany od pierwszego tygodnia, nie na końcu.

### Zawartość slice'a (3–5 min)
Skompresowane M02 → M03 → M04 → M05: wejście, pierwszy kontakt z MM-01 (z wprowadzeniem prognozy), Silent Hall z 3 trasami, alarm, 45–60 s pościgu, zamknięcie grodzi. Terminal B-12 jako ekran-zaślepka (pełny replay w Quality Slice).

### Kolejność zadań
0. Zaimportować prototyp i dokumenty do repo (`docs/`), zrobić pierwszy commit.
1. **Spike web (1–2 dni):** pusta scena, kapsuła Leona, kapsuła MM-01 ze światłem „oka”, jedno wnętrze. Eksport, pomiar FPS w Chrome i Firefox na najsłabszym docelowym laptopie.
2. Kontroler 2.5D: ruch, skok, kucanie, wejście w kryjówkę, autorskie przejścia między płaszczyznami.
3. Percepcja: widzenie oparte na świetle, zasięg hałasu, ostatnia znana pozycja, debug overlay.
4. MM-01: Patrol → Suspicion → Chase → Search → Return + hotspoty prognozy.
5. Silent Hall greybox: 3 trasy + trasa „trzecia” (gaśnięcie sektorów).
6. Pościg greybox z odcinaniem drogi zamiast przewagi prędkości.
7. Checkpointy i flow porażki.
8. Playtest z 5 osobami spoza projektu.

### Testy akceptacyjne
- **Uczciwość percepcji:** test automatyczny/debug, w którym MM-01 nie wykrywa Leona bez linii wzroku (raycast) ani poza zasięgiem dźwięku. Zero wyjątków.
- **Search:** po zgubieniu gracza MM-01 sprawdza ostatnią znaną pozycję, potem *widoczne* hotspoty prognozy, i nigdy pozycję, której nie widział.
- **Zrozumiałość:** co najmniej 4 z 5 testerów potrafi powiedzieć, *dlaczego* zostało wykrytych.
- **Wybór:** testerzy przechodzą Silent Hall co najmniej dwiema różnymi trasami (łącznie).
- **Kamera:** zero porażek, które testerzy przypisują kamerze lub niewidocznej krawędzi.
- **Powrót po porażce:** gracz jest z powrotem w akcji w mniej niż 5 s, bez powtarzania dialogów.
- **Pościg:** pierwsza próba kończy się porażką u części graczy, ale nikt nie potrzebuje więcej niż ok. 4 prób na segment. *Progi do kalibracji po pierwszym teście.*
- **Web:** stabilne FPS na docelowym słabym sprzęcie. Konkretny próg (np. 30/60 FPS) i rozmiar pobierania ustalić po spike'u, nie z góry.

---

## I. Decyzje do zatwierdzenia (5)

**I-1. Logika B-12 i pierwszej misji**
- **A (rekomendacja):** dead man's switch („trzecia droga, B-12”) + „Noc przed czystką” + „K.” jako impuls „dziś albo nigdy”.
- B: Dave zostawił trop w zaplanowanej przesyłce analogowej (list u notariusza), bez czystki.
- C: zostawić obecny opis.
- *Uzasadnienie:* A jednym ruchem zamyka trzy luki (dlaczego teraz, dlaczego strażnik, dlaczego Kate) i daje zegar bez wszechmocy Marcusa.

**I-2. Signature mechanic „Prognoza”**
- **A (rekomendacja):** MVP statyczny + jedna skryptowana adaptacja („Pattern logged”).
- B: pełna adaptacja od greyboxa.
- C: klasyczny stealth bez prognozy.
- *Uzasadnienie:* A sprawdza, czy mechanika jest zabawna, zanim zapłacimy za systemowe AI. C to bezpieczny, ale anonimowy stealth.

**I-3. Status Kate w korporacji**
- **A (rekomendacja):** compliance/kontrola wewnętrzna, korporacja zna związek i trzyma ją jako przynętę, a Kate o tym wie.
- B: związek był tajny, korporacja nie wie.
- C: Kate pracuje w zespole MIRROR.
- *Uzasadnienie:* A jest wiarygodne w firmie nadzoru i samo generuje ograniczenia Kate. B jest kruche. C czyni ją zbyt potężną i podejrzaną.

**I-4. Konflikt braci**
- **A (rekomendacja):** Dave chłodno odsunął Leona, gdy ten prosił o pomoc, bo już prowadził śledztwo i chciał go chronić. Ujawnione późno.
- B: stary rodzinny konflikt niezwiązany ze śledztwem.
- C: wina leży po stronie Leona.
- *Uzasadnienie:* A spina konflikt z intrygą, nie obciąża Dave'a i daje finałowe pojednanie z treścią.

**I-5. Kierunek wizualny vs. web**
- **A (rekomendacja):** renderer Compatibility od dnia 1, stylizacja „dioramy” (sylwetki, warstwy, kolor jako narracja), Unravel Two jako odniesienie emocji i skali, nie technologii.
- B: Forward+ dla desktopowego buildu, a web jako uproszczona wersja.
- C: decyzja dopiero po vertical slice.
- *Uzasadnienie:* przy strategii web-first B oznacza podwójną produkcję, a C ryzykuje przerobienie całej oprawy.

*Bonus, nie blokuje:* biblioteka wraca w The Paper District (TOP 5 #4). Można zatwierdzić razem z aktualizacją kanonu.

---

## Najlepszy następny krok

**Zaimportować prototyp do repozytorium i zrobić 1–2-dniowy spike eksportu web** (scena-pudełko, Leon i MM-01 jako kapsuły, światło „oka”, jedno wnętrze biblioteki, pomiar na najsłabszym docelowym laptopie). Wcześniej, w godzinę, zatwierdzić decyzje I-1…I-5.

**Dlaczego to ma najwyższy zwrot:** wszystkie decyzje fabularne są tanie i odwracalne, a renderer nie jest. Wynik spike'u ustala estetykę, budżet oświetlenia, skalę wnętrz i realny cel jakości dla *każdej* kolejnej godziny pracy nad grafiką. Jeżeli okaże się, że przeglądarka nie udźwignie zakładanego nastroju, lepiej wiedzieć to po dwóch dniach niż po trzech miesiącach. Kryterium decyzji po spike'u: **stabilna płynność na słabym sprzęcie i akceptowalny nastrój → zostajemy przy kierunku; płynność jest, ale nastrój płaski → przechodzimy na stylizację dioramy; brak płynności → upraszczamy sceny albo wracamy do decyzji web-first vs. desktop-first.**
