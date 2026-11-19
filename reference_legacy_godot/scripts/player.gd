extends CharacterBody3D
## Elias: constrained X/Y movement in a fully 3D world.
## Code-only prototype controls, not final input remapping or animations.

const WALK_SPEED: float = 4.5
const SPRINT_SPEED: float = 6.5
const CROUCH_SPEED: float = 2.3
const JUMP_SPEED: float = 7.0
const GRAVITY: float = 20.0

var hide_spots: Array[float] = [-7.0, 2.0, 12.0]
var is_hidden: bool = false
var is_crouching: bool = false
var is_sprinting: bool = false
var controls_locked: bool = false
var spawn_position: Vector3 = Vector3(-22.0, 1.0, 0.0)

func _physics_process(delta: float) -> void:
    var direction: float = 0.0
    is_crouching = false
    is_sprinting = false

    if not controls_locked:
        if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
            direction -= 1.0
        if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
            direction += 1.0
        is_crouching = Input.is_key_pressed(KEY_CTRL) or Input.is_key_pressed(KEY_C)
        is_sprinting = Input.is_key_pressed(KEY_SHIFT) and not is_crouching and absf(direction) > 0.01

    var speed: float = WALK_SPEED
    if is_crouching:
        speed = CROUCH_SPEED
    elif is_sprinting:
        speed = SPRINT_SPEED

    velocity.x = direction * speed
    velocity.z = 0.0
    if not is_on_floor():
        velocity.y -= GRAVITY * delta
    elif not controls_locked and Input.is_key_pressed(KEY_SPACE):
        velocity.y = JUMP_SPEED
    else:
        velocity.y = 0.0

    move_and_slide()
    global_position.z = 0.0
    is_hidden = false
    if is_crouching and is_on_floor():
        for spot_x in hide_spots:
            if absf(global_position.x - spot_x) < 1.15:
                is_hidden = true
                break

func respawn() -> void:
    global_position = spawn_position
    velocity = Vector3.ZERO
    is_hidden = false
    is_crouching = false
    is_sprinting = false
