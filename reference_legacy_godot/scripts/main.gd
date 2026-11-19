extends Node3D
## Margin City 0.1: self-contained, procedural, no third-party assets.
## MISSION: reach the trading terminal while avoiding the Inspector.

const PlayerScript = preload("res://scripts/player.gd")
const InspectorScript = preload("res://scripts/inspector_ai.gd")
const ChartScript = preload("res://scripts/trading_chart.gd")
const ReplayEngine = preload("res://scripts/replay_engine.gd")
const TERMINAL_X: float = 21.0

var player
var inspector
var camera: Camera3D
var objective_label: Label
var enemy_label: Label
var hint_label: Label
var trading_panel: PanelContainer
var chart
var trade_result_label: Label
var close_button: Button
var trade_buttons: Array[Button] = []
var candles: Array = []
var trading_open: bool = false
var trade_in_progress: bool = false
var trade_completed: bool = false
var virtual_cash: float = 1000.0
var catches: int = 0

func _ready() -> void:
    _create_world()
    _create_player()
    _create_inspector()
    _create_terminal()
    _create_camera()
    _create_interface()
    _load_fixture()

func _process(delta: float) -> void:
    if player == null:
        return
    var focus_x: float = player.global_position.x + clampf(player.velocity.x * 0.22, -1.4, 1.4)
    # Three authored shot presets blended continuously; movement remains in X/Y.
    var target_offset := Vector3(2.5, 6.5, 18.0)
    if player.global_position.x > 12.0:
        target_offset = Vector3(5.2, 6.0, 15.0)
    elif player.global_position.x > -10.0:
        target_offset = Vector3(3.6, 7.5, 19.0)
    var desired_camera_pos: Vector3 = Vector3(focus_x, 0.0, 0.0) + target_offset
    camera.global_position = camera.global_position.lerp(desired_camera_pos, minf(1.0, delta * 2.6))
    camera.look_at(Vector3(focus_x + 1.5, 1.5, 0.0), Vector3.UP)
    enemy_label.text = "INSPEKTOR: %s  |  Schwytania: %d" % [inspector.state_name(), catches]
    if trade_completed:
        objective_label.text = "MISJA UKONCZONA!  |  Kapital: $%.2f" % virtual_cash
        hint_label.text = "Pierwszy prototyp zakonczony. Kolejny etap: pionowy wycinek misji."
    elif trading_open:
        hint_label.text = "Terminal: dane SYNTETYCZNE. Bez prawdziwych transakcji."
    elif absf(player.global_position.x - TERMINAL_X) < 2.5:
        hint_label.text = "[E] Otworz terminal  |  Dane testowe (nie notowania rynkowe)"
    elif player.is_hidden:
        hint_label.text = "UKRYTY: Inspektor Cie nie widzi."
    else:
        hint_label.text = "A/D: ruch  SHIFT: bieg  CTRL: ukrycie przy szafie  SPACJA: skok"

func _unhandled_input(event: InputEvent) -> void:
    if not (event is InputEventKey) or not event.pressed or event.echo:
        return
    if event.keycode == KEY_ESCAPE and trading_open and not trade_in_progress:
        _close_terminal()
    if event.keycode == KEY_E and not trading_open and not trade_completed:
        if absf(player.global_position.x - TERMINAL_X) < 2.5:
            _open_terminal()

func _create_world() -> void:
    var world_environment := WorldEnvironment.new()
    var env := Environment.new()
    env.background_mode = Environment.BG_COLOR
    env.background_color = Color(0.055, 0.075, 0.13)
    env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.ambient_light_color = Color(0.48, 0.54, 0.70)
    env.ambient_light_sky_contribution = 0.0
    env.ambient_light_energy = 0.7
    world_environment.environment = env
    add_child(world_environment)

    var sunlight := DirectionalLight3D.new()
    sunlight.rotation_degrees = Vector3(-46.0, -32.0, 0.0)
    sunlight.light_color = Color(0.80, 0.87, 1.0)
    sunlight.light_energy = 1.0
    sunlight.shadow_enabled = true
    add_child(sunlight)

    _static_box("Floor", Vector3(0.0, -0.5, 0.0), Vector3(52.0, 1.0, 9.0), Color(0.17, 0.22, 0.31))
    _static_box("JumpObstacle", Vector3(-13.0, 0.42, 0.0), Vector3(1.15, 0.84, 1.3), Color(0.47, 0.38, 0.34))

    # Monumental financial district; geometry outside the movement plane.
    for x in [-22.0, -13.0, -3.0, 8.0, 18.0]:
        _decor_box("DistantTower", Vector3(x, 8.0, -8.0), Vector3(5.0, 16.0, 2.2), Color(0.12, 0.16, 0.25))
        _decor_box("TowerWindow", Vector3(x + 1.1, 5.5, -6.8), Vector3(0.35, 5.8, 0.2), Color(0.63, 0.49, 0.30))
    _decor_box("FarWall", Vector3(0.0, 4.0, -11.0), Vector3(52.0, 9.0, 1.0), Color(0.10, 0.14, 0.23))

    # Alcoves: crouch when close to their X position to become hidden.
    for spot_x in [-7.0, 2.0, 12.0]:
        _decor_box("HideCloset", Vector3(spot_x, 1.4, 1.5), Vector3(2.0, 2.8, 1.0), Color(0.22, 0.30, 0.37))
        _decor_box("HideDoor", Vector3(spot_x, 1.4, 2.08), Vector3(1.2, 2.2, 0.09), Color(0.10, 0.12, 0.18))
        _decor_box("HideMarker", Vector3(spot_x, 2.8, 2.12), Vector3(1.0, 0.13, 0.08), Color(0.10, 0.78, 0.63))

    # Tall foreground framing elements to evoke cinematic depth.
    for x in [-25.0, -5.0, 15.0, 25.0]:
        _decor_box("ForegroundPillar", Vector3(x, 5.0, 5.3), Vector3(0.65, 10.0, 0.65), Color(0.09, 0.12, 0.18))

func _create_player() -> void:
    player = CharacterBody3D.new()
    player.name = "Elias"
    player.set_script(PlayerScript)
    player.position = Vector3(-22.0, 1.0, 0.0)
    add_child(player)
    var capsule := CapsuleShape3D.new()
    capsule.radius = 0.35
    capsule.height = 1.7
    var collider := CollisionShape3D.new()
    collider.shape = capsule
    player.add_child(collider)
    _visual_box(player, "Coat", Vector3(0.0, -0.05, 0.0), Vector3(0.70, 1.12, 0.53), Color(0.87, 0.61, 0.30))
    _visual_box(player, "Head", Vector3(0.0, 0.71, 0.0), Vector3(0.46, 0.47, 0.45), Color(0.94, 0.79, 0.61))
    _visual_box(player, "Satchel", Vector3(0.42, -0.19, 0.0), Vector3(0.38, 0.42, 0.46), Color(0.20, 0.13, 0.09))

func _create_inspector() -> void:
    inspector = Node3D.new()
    inspector.name = "Inspector"
    inspector.set_script(InspectorScript)
    inspector.position = Vector3(4.5, 1.35, 0.0)
    inspector.player = player
    add_child(inspector)
    _visual_box(inspector, "TallBody", Vector3(0.0, 0.13, 0.0), Vector3(0.82, 2.55, 0.76), Color(0.60, 0.19, 0.25))
    _visual_box(inspector, "Hat", Vector3(0.0, 1.7, 0.0), Vector3(1.2, 0.24, 0.90), Color(0.24, 0.10, 0.16))
    _visual_box(inspector, "Head", Vector3(0.0, 1.43, 0.0), Vector3(0.57, 0.56, 0.62), Color(0.77, 0.56, 0.50))
    inspector.player_caught.connect(_on_player_caught)

func _create_terminal() -> void:
    _decor_box("TerminalPedestal", Vector3(TERMINAL_X, 0.75, 0.0), Vector3(1.1, 1.5, 1.2), Color(0.29, 0.34, 0.40))
    _decor_box("TerminalScreen", Vector3(TERMINAL_X, 1.7, 0.0), Vector3(1.2, 0.9, 0.2), Color(0.12, 0.72, 0.69))
    var beacon := OmniLight3D.new()
    beacon.position = Vector3(TERMINAL_X, 2.0, 1.0)
    beacon.light_color = Color(0.13, 0.91, 0.80)
    beacon.light_energy = 1.5
    beacon.omni_range = 5.0
    add_child(beacon)

func _create_camera() -> void:
    camera = Camera3D.new()
    camera.current = true
    camera.fov = 48.0
    camera.position = Vector3(-19.5, 6.5, 18.0)
    add_child(camera)
    camera.look_at(Vector3(-20.5, 1.5, 0.0), Vector3.UP)

func _create_interface() -> void:
    var canvas := CanvasLayer.new()
    add_child(canvas)
    var ui := Control.new()
    canvas.add_child(ui)
    ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

    objective_label = _hud_label(ui, Vector2(20, 15), "CEL: Dotrzyj do terminalu, unikajac Inspektora", 21)
    enemy_label = _hud_label(ui, Vector2(20, 49), "INSPEKTOR: PATROL", 16)
    hint_label = _hud_label(ui, Vector2(20, 670), "A/D: ruch", 18)

    var center := CenterContainer.new()
    ui.add_child(center)
    center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    trading_panel = PanelContainer.new()
    trading_panel.custom_minimum_size = Vector2(620.0, 0.0)
    center.add_child(trading_panel)
    var style := StyleBoxFlat.new()
    style.bg_color = Color(0.07, 0.10, 0.16, 0.98)
    style.set_content_margin_all(18.0)
    style.corner_radius_top_left = 10
    style.corner_radius_top_right = 10
    style.corner_radius_bottom_left = 10
    style.corner_radius_bottom_right = 10
    trading_panel.add_theme_stylebox_override("panel", style)

    var column := VBoxContainer.new()
    column.add_theme_constant_override("separation", 10)
    trading_panel.add_child(column)
    var title := Label.new()
    title.text = "TERMINAL / MARKET REPLAY - DANE SYNTETYCZNE"
    title.add_theme_font_size_override("font_size", 19)
    column.add_child(title)
    var info := Label.new()
    info.text = "Widzisz tylko 12 swiec. Wybierz LONG, SHORT lub POMIN; wynik po 8 kolejnych."
    column.add_child(info)
    chart = Control.new()
    chart.set_script(ChartScript)
    chart.custom_minimum_size = Vector2(570.0, 220.0)
    column.add_child(chart)
    var buttons := HBoxContainer.new()
    column.add_child(buttons)
    for decision in ["LONG", "SHORT", "POMIN"]:
        var trade_button := Button.new()
        trade_button.text = decision
        trade_button.custom_minimum_size = Vector2(170.0, 42.0)
        buttons.add_child(trade_button)
        trade_button.pressed.connect(_on_trade_pressed.bind(decision))
        trade_buttons.append(trade_button)
    trade_result_label = Label.new()
    trade_result_label.text = "Nominal: $100 | bez dzwigni | 10 bps oplaty + 5 bps poslizgu / strona"
    column.add_child(trade_result_label)
    close_button = Button.new()
    close_button.text = "Zamknij terminal"
    close_button.pressed.connect(_close_terminal)
    close_button.visible = false
    column.add_child(close_button)
    trading_panel.visible = false

func _hud_label(parent: Control, where: Vector2, content: String, font_size: int) -> Label:
    var label := Label.new()
    label.position = where
    label.text = content
    label.add_theme_font_size_override("font_size", font_size)
    label.add_theme_color_override("font_color", Color(0.96, 0.95, 0.88))
    parent.add_child(label)
    return label

func _load_fixture() -> void:
    var raw: String = FileAccess.get_file_as_string("res://data/trading_synthetic.json")
    var payload: Variant = JSON.parse_string(raw)
    if typeof(payload) != TYPE_DICTIONARY or not payload.has("candles"):
        push_error("Invalid synthetic OHLC fixture")
        return
    candles = payload["candles"]
    chart.candles = candles
    chart.visible_bars = 12
    chart.queue_redraw()

func _open_terminal() -> void:
    if candles.size() < 20:
        push_warning("No replay data loaded")
        return
    trading_open = true
    player.controls_locked = true
    trading_panel.visible = true

func _on_trade_pressed(decision: String) -> void:
    if trade_completed or trade_in_progress:
        return
    var result: Dictionary = ReplayEngine.evaluate(candles, 11, 19, decision, 100.0)
    if not result["ok"]:
        push_error(str(result["error"]))
        return
    trade_in_progress = true
    for button in trade_buttons:
        button.disabled = true
    trade_result_label.text = "Odtwarzanie kolejnych swiec..."
    for visible_count in range(13, 21):
        if not is_inside_tree():
            return
        chart.visible_bars = visible_count
        chart.queue_redraw()
        await get_tree().create_timer(0.24).timeout

    var pnl: float = float(result["net_pnl"])
    virtual_cash += pnl
    trade_result_label.text = "%s | Wejscie: %.2f | Wyjscie: %.2f | PnL netto: $%+.2f | Kapital: $%.2f" % [decision, float(result["entry"]), float(result["exit"]), pnl, virtual_cash]
    trade_completed = true
    trade_in_progress = false
    close_button.visible = true

func _close_terminal() -> void:
    if trade_in_progress:
        return
    trading_open = false
    player.controls_locked = false
    trading_panel.visible = false

func _on_player_caught() -> void:
    catches += 1
    player.respawn()
    inspector.reset_patrol()

func _static_box(box_name: String, where: Vector3, dimensions: Vector3, color: Color) -> void:
    var body := StaticBody3D.new()
    body.name = box_name
    body.position = where
    add_child(body)
    _visual_box(body, "Mesh", Vector3.ZERO, dimensions, color)
    var collider := CollisionShape3D.new()
    var shape := BoxShape3D.new()
    shape.size = dimensions
    collider.shape = shape
    body.add_child(collider)

func _decor_box(box_name: String, where: Vector3, dimensions: Vector3, color: Color) -> void:
    var mesh := _visual_box(self, box_name, where, dimensions, color)
    mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON

func _visual_box(parent: Node3D, box_name: String, where: Vector3, dimensions: Vector3, color: Color) -> MeshInstance3D:
    var mesh_instance := MeshInstance3D.new()
    mesh_instance.name = box_name
    mesh_instance.position = where
    var box := BoxMesh.new()
    box.size = dimensions
    mesh_instance.mesh = box
    var mat := StandardMaterial3D.new()
    mat.albedo_color = color
    mat.roughness = 0.83
    mat.metallic = 0.08
    mesh_instance.material_override = mat
    parent.add_child(mesh_instance)
    return mesh_instance
