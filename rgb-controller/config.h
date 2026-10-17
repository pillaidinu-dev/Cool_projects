// Hardware wiring and tuning for the RGB light controller.
// Change the values here to match your build; the sketch itself should not need edits.
#pragma once

#define FIRMWARE_VERSION "1.0"

// ---- OLED (SSD1306 128x64, I2C: SDA=A4, SCL=A5 on an Uno/Nano) ----
#define OLED_WIDTH 128
#define OLED_HEIGHT 64
#define OLED_I2C_ADDR 0x3C  // some modules use 0x3D

// ---- Joystick module (VRx, VRy, SW) ----
#define JOY_X_PIN A0
#define JOY_Y_PIN A1
#define JOY_SW_PIN 2          // push-button, wired to GND (internal pull-up is used)
#define JOY_SWAP_XY false     // set true if the module is mounted rotated 90 degrees
#define JOY_INVERT_X false    // set true if left/right are reversed
#define JOY_INVERT_Y false    // set true if up/down are reversed
#define JOY_THRESHOLD 300     // deflection from centre (0-512) that counts as a push
#define JOY_RELEASE 200       // deflection below which the stick counts as released
#define JOY_REPEAT_DELAY_MS 400
#define JOY_REPEAT_MS 130
#define BUTTON_DEBOUNCE_MS 25

// ---- Sliding potentiometer (wiper to SLIDER_PIN, ends to 5V and GND) ----
#define SLIDER_PIN A2
#define SLIDER_INVERT false    // set true if sliding "up" lowers the value
#define SLIDER_GRAB_WINDOW 6   // 0-255: how close the slider must get to pick up a value

// ---- Addressable RGB LEDs (WS2812B / NeoPixel strip or ring) ----
#define LED_DATA_PIN 6         // through a ~330 ohm resistor
#define LED_COUNT 8
#define LED_CHIPSET WS2812B
#define LED_COLOR_ORDER GRB
#define LED_MAX_MILLIAMPS 500  // FastLED dims the strip to stay under this budget

// ---- 4x4 matrix keypad ----
#define KEYPAD_ROWS 4
#define KEYPAD_COLS 4
#define KEYPAD_ROW_PINS {3, 4, 5, 7}
#define KEYPAD_COL_PINS {8, 9, 10, 11}
#define KEYPAD_KEYMAP {      \
    {'1', '2', '3', 'A'},    \
    {'4', '5', '6', 'B'},    \
    {'7', '8', '9', 'C'},    \
    {'*', '0', '#', 'D'}}

// ---- PIN lock ----
#define DEFAULT_PIN "1234"         // used until a new PIN is set from the menu
#define PIN_MIN_LEN 4
#define PIN_MAX_LEN 8
#define PIN_REQUIRED_AT_STARTUP 1  // 0 = go straight to the menu after the splash
#define PIN_MAX_ATTEMPTS 3
#define PIN_LOCKOUT_MS 30000UL     // keypad is ignored this long after too many wrong PINs
#define AUTO_LOCK_MS 0UL           // lock after this long without input; 0 = never

// ---- Timing ----
#define SPLASH_MS 2500UL
#define LED_FRAME_MS 16UL       // ~60 fps
#define SETTINGS_SAVE_DELAY_MS 3000UL  // wait for the controls to settle before writing EEPROM
