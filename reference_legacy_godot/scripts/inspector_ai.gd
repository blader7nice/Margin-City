extends Node3D
## Minimal deterministic state machine for 2.5D lane.
## LOS raycast blocks vision through StaticBody3D geometry.

signal ai_state_changed(new_state: String)
signal player_caught

enum State { PATROL, SUSPICIOUS, CHASE, SEARCH, RETURN }

var state: State = State.PATROL
var player: CharacterBody3D
var patrol_min_x: float = -1.0
var patrol_max_x: float = 14.0
var direction: float = 1.0
var last_known_x: float = 0.0
var time_in_state: float = 0.0
var suspicion: float = 0.0
var catch_cooldown: float = 0.0

func state_name() -> String:
    return ["PATROL", "SUSPICIOUS", "CHASE", "SEARCH", "RETURN"][int(state)]

func _physics_process(delta: float) -> void:
    if player == null or player.controls_locked:
        return
    time_in_state += delta
    catch_cooldown = maxf(0.0, catch_cooldown - delta)

    var dx: float = player.global_position.x - global_position.x
    var distance: float = absf(dx)
    var height_close: bool = absf(player.global_position.y - global_position.y) < 2.0
    var facing_player: bool = dx * direction >= 0.0
    var in_sight_cone: bool = facing_player or distance < 1.5
    var sight_range: float = 4.0 if player.is_crouching else 7.5
    var visible: bool = not player.is_hidden and height_close and distance < sight_range and in_sight_cone and _has_line_of_sight()
    var heard_running: bool = player.is_sprinting and not player.is_hidden and distance < 5.0

    if visible:
        suspicion = minf(1.0, suspicion + delta * 1.5)
        last_known_x = player.global_position.x
    else:
        suspicion = maxf(0.0, suspicion - delta * 0.6)
    if suspicion >= 0.75 and state != State.CHASE:
        _set_state(State.CHASE)
    elif heard_running and state == State.PATROL:
        last_known_x = player.global_position.x
        _set_state(State.SUSPICIOUS)

    match state:
        State.PATROL:
            _move_x(patrol_max_x if direction > 0.0 else patrol_min_x, 2.0, delta)
            if global_position.x <= patrol_min_x + 0.05:
                direction = 1.0
            elif global_position.x >= patrol_max_x - 0.05:
                direction = -1.0
        State.SUSPICIOUS:
            _move_x(last_known_x, 2.5, delta)
            if time_in_state > 2.4:
                _set_state(State.SEARCH)
        State.CHASE:
            if visible:
                _move_x(player.global_position.x, 5.7, delta)
            else:
                _set_state(State.SEARCH)
            if visible and distance < 0.95 and height_close and catch_cooldown <= 0.0:
                catch_cooldown = 1.5
                player_caught.emit()
        State.SEARCH:
            _move_x(last_known_x, 2.1, delta)
            if time_in_state > 3.0:
                _set_state(State.RETURN)
        State.RETURN:
            # Small greybox: rejoin nearest patrol boundary, then resume patrol.
            var target_x: float = clampf(global_position.x, patrol_min_x, patrol_max_x)
            _move_x(target_x, 2.1, delta)
            if absf(global_position.x - target_x) < 0.1:
                direction = -1.0 if global_position.x >= patrol_max_x - 0.1 else 1.0
                _set_state(State.PATROL)

func _has_line_of_sight() -> bool:
    var origin: Vector3 = global_position + Vector3(0.0, 0.35, 0.0)
    var target: Vector3 = player.global_position + Vector3(0.0, 0.4, 0.0)
    var query := PhysicsRayQueryParameters3D.create(origin, target)
    query.collision_mask = 1
    var result: Dictionary = get_world_3d().direct_space_state.intersect_ray(query)
    return not result.is_empty() and result.get("collider") == player

func _move_x(target: float, speed: float, delta: float) -> void:
    var delta_x: float = target - global_position.x
    if absf(delta_x) > 0.03:
        direction = signf(delta_x)
    global_position.x = move_toward(global_position.x, target, speed * delta)

func reset_patrol() -> void:
    global_position.x = 4.5
    direction = 1.0
    suspicion = 0.0
    last_known_x = global_position.x
    _set_state(State.PATROL)

func _set_state(next_state: State) -> void:
    if state == next_state:
        return
    state = next_state
    time_in_state = 0.0
    ai_state_changed.emit(state_name())
