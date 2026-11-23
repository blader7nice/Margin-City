# Margin City: style guide postaci i plan produkcji (Milestone 03)

Referencja główna to `docs/design/reference/character_lineup_concept.png` (lineup: Leon, Dave, Kate, MM-01).
Nazwy i podpisy na starym concepcie mogą być nieaktualne; **obowiązuje kanon z Master Bible v1.1**.

## 1. Wspólny styl z concept artu

| Cecha | Reguła |
|---|---|
| Stylizacja | Kinowy semi-realizm: realistyczne proporcje ciała z lekko powiększoną głową i dłońmi, miękkie formy, bez kreskówkowej przesady i bez fotorealizmu. |
| Proporcje | Leon ok. 6,8 głowy, Dave ok. 7, Kate ok. 6,8, MM-01 ok. 7,6 (wyższy i smuklejszy, ~2,0 m). |
| Sylwetka | Każda postać musi być rozpoznawalna **w samym konturze z kamery gry** (bohater ma ~110–150 px wysokości): Leon to loki, parka i torba; MM-01 to długi płaszcz, kołnierz i oko; Kate to burza blond loków i torebka; Dave to broda i ciężka kurtka. |
| Materiały | Tkaniny matowe z wyraźną fakturą (dzianina, płótno, wełna, skóra), mało połysku. Metal tylko jako akcent (mosiądz u bohaterów, grafit i stal u MM-01). |
| Paleta | Bohaterowie są ciepli: oliwka, krem, brąz, mosiądz. Korporacja jest zimna i ciemna: grafit, czerń, czerwone światło. Czerwień jest zarezerwowana dla MM-01 i MIRROR. |
| Światło | Postać zawsze ma kontur (rim) od tła i delikatne wypełnienie twarzy. Gameplay nie może zależeć od tego, czy twarz jest widoczna. |

## 2. Karty postaci

**Leon (23, grywalny):**
- curly brown hair, oliwkowa parka oversize noszona otwarta;
- kremowy sweter z warkoczami, szary kaptur bluzy, brązowe spodnie z podwiniętymi nogawkami;
- skarpety, ciężkie sznurowane buty;
- skórzana torba listonoszka przez prawe ramię (na lewym biodrze);
- **mosiężny kompas od Dave'a** — rekwizyt fabularny, dlatego ma własną animację `IdleCompass`;
- bez szalika (w M02 był placeholderem, w concepcie go nie ma).

**MM-01:**
- ~2,0 m, smukły; czarne, faliste włosy zaczesane do tyłu; zarost;
- **jego prawa strona twarzy jest cybernetyczna**: płyty na skroni, oczodole i żuchwie, implant oka, czerwone szwy świetlne, kable do kołnierza;
- lewa strona jest ludzka; bez hełmu i wizjera;
- grafitowo-brązowy płaszcz do łydek, wysoki postawiony kołnierz, ciemnoczerwona wzorzysta podszewka;
- uprząż z mosiężnymi klamrami i czerwonymi listwami LED, czarne rękawice, wysokie buty.

**Dave (33, do zrobienia):**
- starszy brat; zarost lub krótka broda, ciemne włosy, nieco mocniejsza budowa niż Leon;
- ciepła, praktyczna kurtka robocza lub field jacket w brązach, koszula, spodnie robocze;
- w scenach z PROJECT MIRROR ma identyfikator / smycz analityka (detal, nie kostium korporacyjny);
- wygląda na zmęczonego, ale nie na ofiarę: w Rozdziale 1 widzimy go tylko na nagraniu.

**Kate (31, do zrobienia; kanon I-3: kontrola wewnętrzna korporacji, obserwowana):**
- długie kręcone blond włosy;
- kobiecy, praktyczny strój: płaszcz lub trencz w kolorze camel, sweter, spodnie albo spódnica do ruchu, płaskie buty;
- **rozpoznawalna torebka z drobnymi narzędziami**: to jej sylwetkowy znak, jak torba u Leona;
- podwójna tożsamość: ten sam strój z identyfikatorem kontroli wewnętrznej albo bez niego (wariant materiałowy, nie osobny model).

## 3. Kontrakt techniczny (obowiązuje każdą postać, niezależnie od źródła modelu)

- **Szkielet:** wspólne nazwy kości:
  - `hips, spine, chest, neck, head`;
  - `upperarm/forearm/hand.L/.R`;
  - `thigh/shin/foot.L/.R`.

  Kości dodatkowe są dozwolone, np. `coat.L/.R/.B` (poły płaszcza MM-01). Model od artysty lub z AI przepinamy na ten szkielet.
- **Klipy Leona:** `Idle, Walk, Run, CrouchIdle, CrouchWalk, Push, JumpUp, Fall, Slide, Mantle, Hide, Caught` oraz opcjonalnie `IdleCompass`.
- **Klipy MM-01:** `Idle, Walk, Run, Consult` (dłoń przy implancie: „konsultuję MIRROR”), `Grab`.
- **Nazwy materiałów:** od nich zależy detal tkanin w `src/render/fabric.ts`:
  - `knit, canvas, wool, leather, coat, coat_lining, hair, skin` i pokrewne;
  - `mm_eye`: gra steruje kolorem stanu;
  - `cyber_red`: stałe akcenty.
- **AO:** wypalone do koloru wierzchołków (`COLOR_0`).
- **Budżet:**
  - bohater ≤ 50 tys. trójkątów;
  - ≤ 25 materiałów, które i tak dzielą jeden program shadera;
  - GLB ≤ 500 KB po meshopt.

  Stan M03: Leon 45,8 tys. trójkątów / 456 KB / 20 materiałów / 13 klipów; MM-01 30,3 tys. / 319 KB / 19 materiałów / 5 klipów.
- **Eksport:** `gltf-transform optimize --palette false` (paleta zjada nazwy materiałów).

## 4. Stan obecny: uczciwie

Leon v2 i MM-01 v1 zbudowałem skryptowo w Blenderze (`tools/blender/charlib.py`, `make_leon_v2.py`, `make_mm01.py`).

**Mają już:**
- właściwe sylwetki, kostiumy, paletę, rekwizyty;
- półcybernetyczną twarz MM-01;
- płaszcz z kośćmi pół;
- wszystkie animacje kontraktu;
- działają w grze z dystansu i w zbliżeniach.

**Nie mają jakości concept artu:**
- twarze są uproszczone (bliżej figurki niż rzeźby);
- brak fałd tkanin, prawdziwych tekstur i ręcznie dopracowanych dłoni.

To jest **górna granica tego, co sensownie zrobię kodem**. Kolejne iteracje dadzą małe przyrosty za dużo czasu.
Postacie traktuję jako produkcyjne placeholdery z poprawnym kontraktem, nie jako modele docelowe.

## 5. Droga do jakości docelowej: opcje i koszty

> **M04:** aktualne porównanie narzędzi, wyniki testu i plan testu Leona są w `docs/tech/AI_CHARACTER_PIPELINE.md` (ta sekcja to stan z M03).

Ceny zebrałem 20.11.2026 z cenników i agregatorów. Źródła są miejscami sprzeczne, więc ceny trzeba potwierdzić przed zakupem. Kurs ~4 zł/$ jest orientacyjny.

| Opcja | Co dostajemy | Koszt | Ryzyka |
|---|---|---|---|
| **A. Dalej skryptowo (Blender, ja)** | Drobne poprawki obecnych modeli | 0 zł | Sufit jakości już osiągnięty; twarze pozostaną „figurkowe”. |
| **B. AI image-to-3D na płatnym planie** (Tripo Pro ok. $16–20/mies., Meshy Pro ok. $20/mies.; plany darmowe to CC BY 4.0, czyli nie do produktu komercyjnego) | Baza siatki i tekstury z concept artu w kilka minut; potem ja: retopologia, przepięcie na nasz szkielet, nazwy materiałów, nasze animacje | ok. 80–160 zł za 1–2 miesiące | Typowe wady: tekstury z „wypalonym” światłem, zlane palce i ubrania, brudna topologia. Twarz z bliska bywa słaba. Concept art trafia do zewnętrznego serwisu, co wymaga Twojej zgody. |
| **C. Otwarte modele lokalnie** (TRELLIS/TRELLIS.2: wagi na licencji MIT; Hunyuan3D 2.0: licencja **wyklucza UE, UK i Koreę Pd.**, więc dla nas odpada) | Jak B, bez abonamentu | Wynajem GPU, np. kilka–kilkanaście zł/h; w tym kontenerze nie ma GPU | Zależności TRELLIS mają osobne licencje (np. nvdiffrast — niekomercyjna, DINOv3 w TRELLIS.2). Wymaga weryfikacji prawnej przed użyciem komercyjnym. |
| **D. Freelancer 3D** | Rzeźba, retopologia, UV i tekstury zgodne z conceptem, pełne prawa | Marketplace (Fiverr itp.): ~$100–300 za postać z rigiem, przy dużym ryzyku jakości. **Mój szacunek** dla poziomu bliskiego concept artowi: ~$600–1500 za postać (≈ 2,4–6 tys. zł) | Czas 2–6 tygodni, wymaga dobrej specyfikacji (ten dokument) i 3 ofert. |
| **E. Hybryda (rekomendacja)** | B dla wszystkich 4 postaci jako bazy, a D tylko dla **twarzy i dłoni Leona i MM-01** (zbliżenia w przerywnikach) | ~100–160 zł + ~1,5–3 tys. zł (szacunek) | Najlepszy stosunek jakości do kosztu. Najpierw tani test, potem decyzja. |

**Proponowany test (decyzja „rozwijamy / zmieniamy / odpuszczamy”):**

1. Ty kupujesz 1 miesiąc Tripo lub Meshy (~$20) i generujesz Leona oraz MM-01 z concept artu (albo dajesz mi klucz API przez bezpieczny formularz środowiska).
2. Ja w 1 dzień pracy przepinam oba modele na nasz kontrakt i wstawiam je do gry obok obecnych (przełącznik G).
3. Kryteria:
   - sylwetka i twarz z bliska wyraźnie lepsze niż v2/v1 (ocena Twoja i 2–3 osób);
   - skinning bez artefaktów w biegu i kucaniu;
   - ≤ 50 tys. trójkątów;
   - ≤ 1 dzień obróbki na postać.

   Jeśli tak, robimy tak Dave'a i Kate. Jeśli twarze nie przejdą, zlecamy tylko twarze (opcja E).

Źródła cen i licencji:
- [Meshy — pricing/credits (docs)](https://docs.meshy.ai/en/webapp/pricing)
- [Meshy pricing](https://meshy.ai/pricing)
- [Costbench: Tripo AI](https://www.costbench.com/software/ai-3d-generation/tripo-ai/)
- [Tripo blog: commercial use](https://www.tripo3d.ai/blog/ai-generated-3d-assets-commercial-use-steam-mobile-games)
- [Hunyuan3D-2 LICENSE](https://huggingface.co/tencent/Hunyuan3D-2/blob/main/LICENSE)
- [TRELLIS (GitHub)](https://github.com/microsoft/TRELLIS)
- [TRELLIS issue o nvdiffrast](https://github.com/microsoft/TRELLIS/issues/305)
- [Fiverr: koszt 3D artysty](https://fiverr.com/resources/guides/costs/3d-sculpting-artist)

## 6. Dave i Kate w tym samym pipeline

1. **Ten sam szkielet i ten sam `charlib.py`.**
   - Dave: `humanoid_bones(1.04, shoulder=0.21, hip=0.1)`.
   - Kate: `humanoid_bones(0.97, shoulder=0.18, hip=0.095)`.
   - Ten sam eksport i te same nazwy materiałów.
2. **Klipy:**
   - Dave: `Idle, Walk, Talk` (nagranie/kamera), `Bound` (scena ratunku), `Lean`.
   - Kate: `Idle, Walk, Talk, HandOff` (przekazanie narzędzia z torebki), `Glance` (sprawdza, czy nikt nie patrzy), `TypeTerminal`.

   Kontrakt klipów zapiszemy przed modelowaniem.
3. **Kolejność:**
   - najpierw bazy z opcji B lub E, bo Dave i Kate występują głównie w zbliżeniach i dialogach, gdzie twarz jest najważniejsza;
   - skryptowe wersje (jak Leon v2) robimy tylko jako placeholdery do greyboxu rozdziałów 2+.
4. **Kate i podwójna tożsamość:** jeden model, dwa zestawy materiałów (`kate_corp` z identyfikatorem, `kate_private`). Bez drugiego modelu.

## 7. Kolor oka MM-01 — ZATWIERDZONE (23.11.2026)

Oko pokazuje stan percepcji:
- cyjan — patrol;
- bursztyn — podejrzenie;
- czerwień — pościg.

Czerwone akcenty stroju (skroń, szwy, LED-y uprzęży) zostają.
