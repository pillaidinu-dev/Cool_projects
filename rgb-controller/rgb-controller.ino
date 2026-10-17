/*
 * RGB Light Controller
 *
 * A PIN-locked controller for an addressable RGB LED strip with a 128x64 OLED menu.
 *   - Joystick: navigate menus; push-button selects.
 *   - 4x4 keypad: enter the PIN; A/B/C/D are shortcuts once unlocked.
 *   - Sliding potentiometer: brightness or animation speed (whichever is selected).
 *
 * Wiring and tuning live in config.h. See README.md for the parts list and controls.
 */
#include <Wire.h>
#include <EEPROM.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <FastLED.h>
#include <Keypad.h>

#include "config.h"

#define WHITE SSD1306_WHITE
#define BLACK SSD1306_BLACK

// ============================================================ Effects and colors

enum Effect : uint8_t { FX_SOLID, FX_RAINBOW, FX_HUE_CYCLE, FX_BREATHE, FX_CHASE, FX_COUNT };

const char FX_NAME_SOLID[] PROGMEM = "Solid";
const char FX_NAME_RAINBOW[] PROGMEM = "Rainbow";
const char FX_NAME_HUE_CYCLE[] PROGMEM = "Hue Cycle";
const char FX_NAME_BREATHE[] PROGMEM = "Breathe";
const char FX_NAME_CHASE[] PROGMEM = "Chase";
const char *const FX_NAMES[FX_COUNT] PROGMEM = {
    FX_NAME_SOLID, FX_NAME_RAINBOW, FX_NAME_HUE_CYCLE, FX_NAME_BREATHE, FX_NAME_CHASE};

struct NamedColor {
  char name[9];
  uint8_t r, g, b;
};

const NamedColor COLORS[] PROGMEM = {
    {"Red", 255, 0, 0},     {"Orange", 255, 80, 0},    {"Yellow", 255, 200, 0},
    {"Green", 0, 255, 0},   {"Cyan", 0, 255, 200},     {"Blue", 0, 0, 255},
    {"Purple", 140, 0, 255}, {"Pink", 255, 0, 120},    {"White", 255, 255, 255},
    {"Warm Wht", 255, 150, 60},
};
const uint8_t COLOR_COUNT = sizeof(COLORS) / sizeof(COLORS[0]);

// Animation rate in 1/256 hue steps per millisecond: ~22 s per cycle at 0%, ~0.5 s at 100%.
const uint16_t SPEED_MIN_RATE = 3;
const uint16_t SPEED_MAX_RATE = 130;
const uint8_t BREATHE_FLOOR = 12;  // dimmest point of the breathe effect, so it never goes fully dark
const uint8_t CHASE_DIM = 24;      // brightness of the unlit chase pixels
const uint8_t NUDGE_STEP = 13;     // ~5% per joystick nudge

// ============================================================ Persistent settings

const uint8_t SETTINGS_MAGIC = 0xA7;
const uint8_t SETTINGS_VERSION = 1;
const int SETTINGS_ADDR = 0;

struct Settings {
  uint8_t magic;
  uint8_t version;
  uint8_t effect;
  uint8_t color;
  uint8_t brightness;
  uint8_t speed;
  char pin[PIN_MAX_LEN + 1];
};

Settings settings;
bool settingsDirty = false;
uint32_t settingsDirtyAt = 0;

// ============================================================ Hardware

Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
bool displayOk = false;

CRGB leds[LED_COUNT];

char keymap[KEYPAD_ROWS][KEYPAD_COLS] = KEYPAD_KEYMAP;
byte keypadRowPins[KEYPAD_ROWS] = KEYPAD_ROW_PINS;
byte keypadColPins[KEYPAD_COLS] = KEYPAD_COL_PINS;
Keypad keypad(makeKeymap(keymap), keypadRowPins, keypadColPins, KEYPAD_ROWS, KEYPAD_COLS);

// ============================================================ UI state

enum Screen : uint8_t { SCR_SPLASH, SCR_LOCK, SCR_MENU, SCR_STATUS, SCR_ADJUST, SCR_CHANGE_PIN };
enum Input : uint8_t { IN_NONE, IN_UP, IN_DOWN, IN_LEFT, IN_RIGHT, IN_SELECT };
enum MenuId : uint8_t { MENU_MAIN, MENU_EFFECTS, MENU_COLORS };
enum SliderTarget : uint8_t { SLIDE_BRIGHTNESS, SLIDE_SPEED };

enum MainItem : uint8_t {
  MAIN_STATUS, MAIN_EFFECTS, MAIN_COLORS, MAIN_BRIGHTNESS, MAIN_SPEED, MAIN_CHANGE_PIN, MAIN_LOCK,
  MAIN_COUNT
};
const char MAIN_LABEL_STATUS[] PROGMEM = "Now Playing";
const char MAIN_LABEL_EFFECTS[] PROGMEM = "Effects";
const char MAIN_LABEL_COLORS[] PROGMEM = "Colors";
const char MAIN_LABEL_BRIGHTNESS[] PROGMEM = "Brightness";
const char MAIN_LABEL_SPEED[] PROGMEM = "Speed";
const char MAIN_LABEL_CHANGE_PIN[] PROGMEM = "Change PIN";
const char MAIN_LABEL_LOCK[] PROGMEM = "Lock";
const char *const MAIN_LABELS[MAIN_COUNT] PROGMEM = {
    MAIN_LABEL_STATUS, MAIN_LABEL_EFFECTS, MAIN_LABEL_COLORS, MAIN_LABEL_BRIGHTNESS,
    MAIN_LABEL_SPEED, MAIN_LABEL_CHANGE_PIN, MAIN_LABEL_LOCK};

const uint8_t MENU_ROWS = 5;
const uint8_t TEXT_BUF = 22;  // one full line of size-1 text plus the terminator

Screen screen = SCR_SPLASH;
bool redraw = true;
uint32_t lastDrawAt = 0;
uint32_t lastInputAt = 0;
uint32_t splashStart = 0;

uint8_t menuId = MENU_MAIN;
uint8_t menuCursor = 0;
uint8_t menuTop = 0;
uint8_t mainCursor = 0;  // restored when backing out of a submenu

char pinBuf[PIN_MAX_LEN + 1];
uint8_t pinLen = 0;
char newPin[PIN_MAX_LEN + 1];
enum PinStep : uint8_t { PIN_STEP_CURRENT, PIN_STEP_NEW, PIN_STEP_CONFIRM };
uint8_t pinStep = PIN_STEP_CURRENT;
uint8_t failedAttempts = 0;
uint32_t lockoutUntil = 0;

// A notice replaces the hint line on the PIN screens; a toast pops over any screen.
// Both keep flash pointers rather than copies: RAM is tight next to the OLED buffer.
PGM_P noticeFmt = nullptr;
int noticeArg = 0;
uint32_t noticeUntil = 0;
const __FlashStringHelper *toastMsg = nullptr;
uint32_t toastUntil = 0;

// Joystick and slider
int joyCenterX = 512;
int joyCenterY = 512;
Input joyHeld = IN_NONE;
uint32_t joyNextRepeat = 0;
bool buttonStable = HIGH;
bool buttonLastRaw = HIGH;
uint32_t buttonChangedAt = 0;

uint16_t sliderFilt = 0;  // 4x the raw reading, low-pass filtered
uint8_t sliderPos = 0;    // 0-255
uint8_t sliderPrev = 0;
bool sliderGrabbed = false;
uint8_t sliderTarget = SLIDE_BRIGHTNESS;

uint32_t animPhase = 0;
uint32_t lastFrameAt = 0;

// ============================================================ Helpers
//
// Every type is declared above this point: the Arduino build inserts function
// prototypes just before the first function definition.

// Rainbow and Hue Cycle make their own colors; the rest use the selected color.
bool effectUsesColor(uint8_t fx) { return fx != FX_RAINBOW && fx != FX_HUE_CYCLE; }


// `until` is a millis() deadline; 0 means "not set".
bool active(uint32_t until, uint32_t now) { return until != 0 && (int32_t)(until - now) > 0; }

uint8_t percent(uint8_t v) { return ((uint16_t)v * 100 + 127) / 255; }

void effectName(uint8_t fx, char *buf) { strcpy_P(buf, (PGM_P)pgm_read_ptr(&FX_NAMES[fx])); }

void colorName(uint8_t i, char *buf) { strcpy_P(buf, COLORS[i].name); }

CRGB colorValue(uint8_t i) {
  return CRGB(pgm_read_byte(&COLORS[i].r), pgm_read_byte(&COLORS[i].g), pgm_read_byte(&COLORS[i].b));
}

void showToast(const __FlashStringHelper *msg) {
  toastMsg = msg;
  toastUntil = millis() + 1500;
  redraw = true;
}

void showNotice(PGM_P fmt, int arg) {
  noticeFmt = fmt;
  noticeArg = arg;
  noticeUntil = millis() + 2000;
  redraw = true;
}

// ============================================================ Settings

bool validPin(const char *pin) {
  const char *end = (const char *)memchr(pin, '\0', PIN_MAX_LEN + 1);
  if (end == nullptr) return false;
  uint8_t len = end - pin;
  if (len < PIN_MIN_LEN) return false;
  for (uint8_t i = 0; i < len; i++) {
    if (pin[i] < '0' || pin[i] > '9') return false;
  }
  return true;
}

void saveSettings() {
  EEPROM.put(SETTINGS_ADDR, settings);  // put() only rewrites bytes that changed
  settingsDirty = false;
}

void loadSettings() {
  EEPROM.get(SETTINGS_ADDR, settings);
  if (settings.magic == SETTINGS_MAGIC && settings.version == SETTINGS_VERSION &&
      settings.effect < FX_COUNT && settings.color < COLOR_COUNT && validPin(settings.pin)) {
    return;
  }
  settings.magic = SETTINGS_MAGIC;
  settings.version = SETTINGS_VERSION;
  settings.effect = FX_RAINBOW;
  settings.color = 0;
  settings.brightness = 128;
  settings.speed = 100;
  strcpy(settings.pin, DEFAULT_PIN);
  saveSettings();
}

void settingsChanged() {
  settingsDirty = true;
  settingsDirtyAt = millis();
  redraw = true;
}

// ============================================================ Slider

uint8_t &sliderTargetValue() {
  return sliderTarget == SLIDE_SPEED ? settings.speed : settings.brightness;
}

// The slider is "soft takeover": after the value changes some other way, the slider
// does nothing until it is moved to (or past) the current value, so it never jumps.
void releaseSlider() {
  sliderGrabbed = false;
  sliderPrev = sliderPos;
}

void setSliderTarget(uint8_t target) {
  if (target == sliderTarget) return;
  sliderTarget = target;
  releaseSlider();
  redraw = true;
}

void nudgeTarget(int8_t dir) {
  uint8_t &v = sliderTargetValue();
  v = constrain((int)v + dir * NUDGE_STEP, 0, 255);
  releaseSlider();
  settingsChanged();
}

void pollSlider(bool apply) {
  int raw = analogRead(SLIDER_PIN);
  if (SLIDER_INVERT) raw = 1023 - raw;
  sliderFilt = sliderFilt - (sliderFilt >> 2) + raw;

  uint8_t reading = sliderFilt >> 4;
  if (reading == 0 || reading == 255 || abs((int)reading - sliderPos) >= 2) {
    if (reading != sliderPos && (screen == SCR_STATUS || screen == SCR_ADJUST)) redraw = true;
    sliderPos = reading;
  }
  if (!apply) {
    sliderPrev = sliderPos;
    return;
  }

  uint8_t &target = sliderTargetValue();
  if (!sliderGrabbed) {
    int before = (int)sliderPrev - target;
    int after = (int)sliderPos - target;
    if (abs(after) <= SLIDER_GRAB_WINDOW || (before < 0) != (after < 0)) sliderGrabbed = true;
  }
  if (sliderGrabbed && target != sliderPos) {
    target = sliderPos;
    lastInputAt = millis();
    settingsChanged();
  }
  sliderPrev = sliderPos;
}

// ============================================================ Joystick

void calibrateJoystick() {
  long sx = 0, sy = 0;
  for (uint8_t i = 0; i < 8; i++) {
    sx += analogRead(JOY_X_PIN);
    sy += analogRead(JOY_Y_PIN);
  }
  joyCenterX = sx / 8;
  joyCenterY = sy / 8;
}

Input pollJoystick(uint32_t now) {
  int dx = analogRead(JOY_X_PIN) - joyCenterX;
  int dy = analogRead(JOY_Y_PIN) - joyCenterY;
  if (JOY_SWAP_XY) {
    int t = dx;
    dx = dy;
    dy = t;
  }
  if (JOY_INVERT_X) dx = -dx;
  if (JOY_INVERT_Y) dy = -dy;

  Input dir = IN_NONE;
  int mag = max(abs(dx), abs(dy));
  if (mag >= (joyHeld == IN_NONE ? JOY_THRESHOLD : JOY_RELEASE)) {
    if (abs(dy) >= abs(dx)) dir = dy < 0 ? IN_UP : IN_DOWN;
    else dir = dx < 0 ? IN_LEFT : IN_RIGHT;
  }

  if (dir != joyHeld) {
    joyHeld = dir;
    joyNextRepeat = now + JOY_REPEAT_DELAY_MS;
    return dir;
  }
  if (dir != IN_NONE && (int32_t)(now - joyNextRepeat) >= 0) {
    joyNextRepeat = now + JOY_REPEAT_MS;
    return dir;
  }
  return IN_NONE;
}

bool pollButton(uint32_t now) {
  bool raw = digitalRead(JOY_SW_PIN);
  if (raw != buttonLastRaw) {
    buttonLastRaw = raw;
    buttonChangedAt = now;
  }
  if (raw != buttonStable && now - buttonChangedAt >= BUTTON_DEBOUNCE_MS) {
    buttonStable = raw;
    return buttonStable == LOW;
  }
  return false;
}

// ============================================================ Navigation

void goTo(Screen s) {
  screen = s;
  redraw = true;
}

uint8_t menuCount() {
  switch (menuId) {
    case MENU_EFFECTS: return FX_COUNT;
    case MENU_COLORS: return COLOR_COUNT;
    default: return MAIN_COUNT;
  }
}

void openMenu(uint8_t id, uint8_t cursor) {
  menuId = id;
  menuCursor = cursor;
  menuTop = cursor >= MENU_ROWS ? cursor - MENU_ROWS + 1 : 0;
  goTo(SCR_MENU);
}

void moveCursor(int8_t delta) {
  uint8_t n = menuCount();
  menuCursor = (menuCursor + n + delta) % n;
  if (menuCursor < menuTop) menuTop = menuCursor;
  if (menuCursor >= menuTop + MENU_ROWS) menuTop = menuCursor - MENU_ROWS + 1;
  redraw = true;
}

void clearPin() {
  pinLen = 0;
  pinBuf[0] = '\0';
  redraw = true;
}

void lock() {
  clearPin();
  noticeUntil = toastUntil = 0;
  goTo(SCR_LOCK);
}

void unlock() {
  failedAttempts = 0;
  releaseSlider();
  openMenu(MENU_MAIN, MAIN_STATUS);
}

void finishSplash() {
  if (PIN_REQUIRED_AT_STARTUP) lock();
  else unlock();
}

void startChangePin() {
  pinStep = PIN_STEP_CURRENT;
  clearPin();
  noticeUntil = toastUntil = 0;
  goTo(SCR_CHANGE_PIN);
}

void openAdjust(uint8_t target) {
  setSliderTarget(target);
  goTo(SCR_ADJUST);
}

void menuSelect() {
  switch (menuId) {
    case MENU_MAIN:
      mainCursor = menuCursor;
      switch (menuCursor) {
        case MAIN_STATUS: goTo(SCR_STATUS); break;
        case MAIN_EFFECTS: openMenu(MENU_EFFECTS, settings.effect); break;
        case MAIN_COLORS: openMenu(MENU_COLORS, settings.color); break;
        case MAIN_BRIGHTNESS: openAdjust(SLIDE_BRIGHTNESS); break;
        case MAIN_SPEED: openAdjust(SLIDE_SPEED); break;
        case MAIN_CHANGE_PIN: startChangePin(); break;
        case MAIN_LOCK: lock(); break;
      }
      break;
    case MENU_EFFECTS:
      settings.effect = menuCursor;
      settingsChanged();
      break;
    case MENU_COLORS:
      settings.color = menuCursor;
      // Picking a color while a rainbow effect runs means "show me this color".
      if (!effectUsesColor(settings.effect)) settings.effect = FX_SOLID;
      settingsChanged();
      break;
  }
}

void menuBack() {
  if (menuId == MENU_MAIN) goTo(SCR_STATUS);
  else openMenu(MENU_MAIN, mainCursor);
}

void handleInput(Input in) {
  switch (screen) {
    case SCR_SPLASH:
      finishSplash();
      break;
    case SCR_MENU:
      if (in == IN_UP) moveCursor(-1);
      else if (in == IN_DOWN) moveCursor(1);
      else if (in == IN_SELECT || in == IN_RIGHT) menuSelect();
      else if (in == IN_LEFT) menuBack();
      break;
    case SCR_STATUS:
      if (in == IN_SELECT) openMenu(MENU_MAIN, mainCursor);
      else if (in == IN_LEFT || in == IN_RIGHT) setSliderTarget(sliderTarget == SLIDE_SPEED ? SLIDE_BRIGHTNESS : SLIDE_SPEED);
      else if (in == IN_UP) nudgeTarget(1);
      else if (in == IN_DOWN) nudgeTarget(-1);
      break;
    case SCR_ADJUST:
      if (in == IN_UP) nudgeTarget(1);
      else if (in == IN_DOWN) nudgeTarget(-1);
      else if (in == IN_LEFT || in == IN_SELECT) openMenu(MENU_MAIN, mainCursor);
      break;
    case SCR_CHANGE_PIN:
      if (in == IN_LEFT) openMenu(MENU_MAIN, mainCursor);
      break;
    case SCR_LOCK:
      break;  // only the keypad works while locked
  }
}

// Shared digit entry for the lock and change-PIN screens. Returns true on '#'.
bool pinEntryKey(char k) {
  if (k >= '0' && k <= '9') {
    noticeUntil = 0;  // typing again dismisses the last error
    if (pinLen < PIN_MAX_LEN) {
      pinBuf[pinLen++] = k;
      pinBuf[pinLen] = '\0';
    }
  } else if (k == '*') {
    if (pinLen > 0) pinBuf[--pinLen] = '\0';
  } else if (k == 'C') {
    clearPin();
  } else if (k == '#') {
    return true;
  }
  redraw = true;
  return false;
}

void lockScreenKey(char k) {
  if (active(lockoutUntil, millis())) return;
  if (!pinEntryKey(k)) return;
  if (strcmp(pinBuf, settings.pin) == 0) {
    unlock();
    return;
  }
  clearPin();
  if (++failedAttempts >= PIN_MAX_ATTEMPTS) {
    failedAttempts = 0;
    lockoutUntil = millis() + PIN_LOCKOUT_MS;
    noticeUntil = 0;
  } else {
    showNotice(PSTR("Wrong PIN, %d left"), PIN_MAX_ATTEMPTS - failedAttempts);
  }
}

void changePinKey(char k) {
  if (k == 'D') {
    openMenu(MENU_MAIN, mainCursor);
    return;
  }
  if (!pinEntryKey(k)) return;
  noticeUntil = 0;
  switch (pinStep) {
    case PIN_STEP_CURRENT:
      if (strcmp(pinBuf, settings.pin) == 0) pinStep = PIN_STEP_NEW;
      else showNotice(PSTR("Wrong PIN"), 0);
      break;
    case PIN_STEP_NEW:
      if (pinLen < PIN_MIN_LEN) {
        showNotice(PSTR("Use at least %d digits"), PIN_MIN_LEN);
      } else {
        strcpy(newPin, pinBuf);
        pinStep = PIN_STEP_CONFIRM;
      }
      break;
    case PIN_STEP_CONFIRM:
      if (strcmp(pinBuf, newPin) != 0) {
        showNotice(PSTR("No match, try again"), 0);
        pinStep = PIN_STEP_NEW;
        break;
      }
      strcpy(settings.pin, newPin);
      saveSettings();
      showToast(F("PIN changed"));
      openMenu(MENU_MAIN, mainCursor);
      return;
  }
  clearPin();
}

void handleKey(char k) {
  switch (screen) {
    case SCR_SPLASH: finishSplash(); break;
    case SCR_LOCK: lockScreenKey(k); break;
    case SCR_CHANGE_PIN: changePinKey(k); break;
    default:
      // Shortcuts once unlocked.
      if (k == 'A') openMenu(MENU_EFFECTS, settings.effect);
      else if (k == 'B') openMenu(MENU_COLORS, settings.color);
      else if (k == 'C') {
        setSliderTarget(sliderTarget == SLIDE_SPEED ? SLIDE_BRIGHTNESS : SLIDE_SPEED);
        showToast(sliderTarget == SLIDE_SPEED ? F("Slider: speed") : F("Slider: brightness"));
      } else if (k == 'D') handleInput(IN_LEFT);
      break;
  }
}

// ============================================================ Drawing

void drawTitle(const __FlashStringHelper *title) {
  display.fillRect(0, 0, OLED_WIDTH, 10, WHITE);
  display.setTextColor(BLACK);
  display.setCursor(2, 1);
  display.print(title);
  display.setTextColor(WHITE);
}

void drawRight(int16_t right, int16_t y, const char *s) {
  display.setCursor(right - 6 * strlen(s), y);
  display.print(s);
}

void drawCentered(int16_t y, const char *s, uint8_t size) {
  display.setTextSize(size);
  display.setCursor((OLED_WIDTH - 6 * size * (int16_t)strlen(s)) / 2, y);
  display.print(s);
  display.setTextSize(1);
}

void drawCentered(int16_t y, const __FlashStringHelper *s, uint8_t size) {
  display.setTextSize(size);
  display.setCursor((OLED_WIDTH - 6 * size * (int16_t)strlen_P((PGM_P)s)) / 2, y);
  display.print(s);
  display.setTextSize(1);
}

// A horizontal bar for a 0-255 value. While the slider hasn't picked the value up,
// a tick shows where the slider currently is so you can see which way to move it.
void drawBar(int16_t x, int16_t y, int16_t w, int16_t h, uint8_t value, bool showSlider) {
  display.drawRect(x, y, w, h, WHITE);
  display.fillRect(x + 2, y + 2, (int32_t)(w - 4) * value / 255, h - 4, WHITE);
  if (showSlider) {
    int16_t sx = x + 1 + (int32_t)(w - 3) * sliderPos / 255;
    display.drawFastVLine(sx, y - 2, h + 4, SSD1306_INVERSE);
  }
}

void percentText(uint8_t v, char *buf) { snprintf_P(buf, 5, PSTR("%u%%"), percent(v)); }

void menuLabel(uint8_t i, char *buf) {
  switch (menuId) {
    case MENU_EFFECTS: effectName(i, buf); break;
    case MENU_COLORS: colorName(i, buf); break;
    default: strcpy_P(buf, (PGM_P)pgm_read_ptr(&MAIN_LABELS[i])); break;
  }
}

// Right-hand column: the current value on the main menu, a marker on the active choice.
void menuValue(uint8_t i, char *buf) {
  buf[0] = '\0';
  switch (menuId) {
    case MENU_EFFECTS:
      if (i == settings.effect) strcpy_P(buf, PSTR("*"));
      break;
    case MENU_COLORS:
      if (i == settings.color && effectUsesColor(settings.effect)) strcpy_P(buf, PSTR("*"));
      break;
    default:
      if (i == MAIN_EFFECTS) effectName(settings.effect, buf);
      else if (i == MAIN_COLORS) colorName(settings.color, buf);
      else if (i == MAIN_BRIGHTNESS) percentText(settings.brightness, buf);
      else if (i == MAIN_SPEED) percentText(settings.speed, buf);
      break;
  }
}

void drawMenu() {
  switch (menuId) {
    case MENU_EFFECTS: drawTitle(F("EFFECTS")); break;
    case MENU_COLORS: drawTitle(F("COLORS")); break;
    default: drawTitle(F("MAIN MENU")); break;
  }
  char label[12], value[12];
  uint8_t n = menuCount();
  for (uint8_t r = 0; r < MENU_ROWS && menuTop + r < n; r++) {
    uint8_t i = menuTop + r;
    int16_t y = 12 + r * 10;
    if (i == menuCursor) {
      display.fillRect(0, y - 1, OLED_WIDTH, 10, WHITE);
      display.setTextColor(BLACK);
    }
    menuLabel(i, label);
    display.setCursor(4, y);
    display.print(label);
    menuValue(i, value);
    drawRight(OLED_WIDTH - 4, y, value);
    display.setTextColor(WHITE);
  }
  // Scroll hints when the list is longer than the screen.
  if (menuTop > 0) display.fillTriangle(121, 7, 125, 7, 123, 3, BLACK);
  if (menuTop + MENU_ROWS < n) display.fillTriangle(121, 61, 125, 61, 123, 63, WHITE);
}

void drawSettingRow(int16_t y, const __FlashStringHelper *label, uint8_t value, bool targeted) {
  display.setCursor(0, y);
  display.print(targeted ? '>' : ' ');
  display.print(label);
  drawBar(26, y, 72, 7, value, targeted && !sliderGrabbed);
  char buf[5];
  percentText(value, buf);
  drawRight(OLED_WIDTH, y, buf);
}

void drawStatus() {
  drawTitle(F("NOW PLAYING"));
  char buf[12];
  effectName(settings.effect, buf);
  display.setTextSize(2);
  display.setCursor(2, 13);
  display.print(buf);
  display.setTextSize(1);

  display.setCursor(2, 31);
  display.print(F("Color: "));
  if (effectUsesColor(settings.effect)) {
    colorName(settings.color, buf);
    display.print(buf);
  } else {
    display.print(F("rainbow"));
  }

  drawSettingRow(42, F("BRI"), settings.brightness, sliderTarget == SLIDE_BRIGHTNESS);
  drawSettingRow(54, F("SPD"), settings.speed, sliderTarget == SLIDE_SPEED);
}

void drawAdjust() {
  drawTitle(sliderTarget == SLIDE_SPEED ? F("SPEED") : F("BRIGHTNESS"));
  uint8_t v = sliderTargetValue();
  char buf[5];
  percentText(v, buf);
  drawCentered(15, buf, 3);
  drawBar(4, 42, OLED_WIDTH - 8, 9, v, !sliderGrabbed);
  drawCentered(55, sliderGrabbed ? F("Slider live") : F("Move slider to grab"), 1);
}

void drawPinScreen(const __FlashStringHelper *title, const __FlashStringHelper *prompt,
                   const __FlashStringHelper *hint, uint32_t now) {
  drawTitle(title);
  display.setCursor(4, 15);
  display.print(prompt);

  display.setTextSize(2);
  display.setCursor(4, 28);
  for (uint8_t i = 0; i < pinLen; i++) display.print('*');
  if (pinLen < PIN_MAX_LEN) display.print('_');
  display.setTextSize(1);

  char buf[TEXT_BUF];
  if (active(lockoutUntil, now)) {
    snprintf_P(buf, TEXT_BUF, PSTR("Try again in %lus"), (lockoutUntil - now + 999) / 1000);
    drawCentered(54, buf, 1);
  } else if (active(noticeUntil, now)) {
    snprintf_P(buf, TEXT_BUF, noticeFmt, noticeArg);
    drawCentered(54, buf, 1);
  } else {
    drawCentered(54, hint, 1);
  }
}

void drawChangePin(uint32_t now) {
  const __FlashStringHelper *prompt =
      pinStep == PIN_STEP_CURRENT ? F("Current PIN:")
      : pinStep == PIN_STEP_NEW   ? F("New PIN:")
                                  : F("Confirm new PIN:");
  drawPinScreen(F("CHANGE PIN"), prompt, F("#=OK *=Del D=Cancel"), now);
}

void drawSplash(uint32_t now) {
  uint32_t t = min(now - splashStart, SPLASH_MS);
  drawCentered(6, F("RGB"), 3);
  drawCentered(34, F("LIGHT CONTROLLER"), 1);
  drawCentered(44, F("v" FIRMWARE_VERSION), 1);
  display.drawRect(14, 55, 100, 6, WHITE);
  display.fillRect(16, 57, 96 * t / SPLASH_MS, 2, WHITE);
}

void drawToast() {
  display.fillRect(8, 22, OLED_WIDTH - 16, 20, BLACK);
  display.drawRect(8, 22, OLED_WIDTH - 16, 20, WHITE);
  drawCentered(28, toastMsg, 1);
}

void drawScreen(uint32_t now) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(WHITE);
  switch (screen) {
    case SCR_SPLASH: drawSplash(now); break;
    case SCR_LOCK: drawPinScreen(F("LOCKED"), F("Enter PIN:"), F("#=OK *=Del C=Clear"), now); break;
    case SCR_MENU: drawMenu(); break;
    case SCR_STATUS: drawStatus(); break;
    case SCR_ADJUST: drawAdjust(); break;
    case SCR_CHANGE_PIN: drawChangePin(now); break;
  }
  if (active(toastUntil, now)) drawToast();
  display.display();
}

// ============================================================ LEDs

void renderLeds(uint32_t now, uint32_t dt) {
  FastLED.setBrightness(settings.brightness);

  if (screen == SCR_SPLASH) {
    // Fill the strip with a rainbow in step with the splash progress bar.
    uint32_t lit = (uint32_t)LED_COUNT * (now - splashStart) / SPLASH_MS + 1;
    for (uint8_t i = 0; i < LED_COUNT; i++) {
      leds[i] = i < lit ? CRGB(CHSV(i * 255 / LED_COUNT, 255, 255)) : CRGB::Black;
    }
    FastLED.show();
    return;
  }

  animPhase += dt * (SPEED_MIN_RATE + (uint32_t)settings.speed * (SPEED_MAX_RATE - SPEED_MIN_RATE) / 255);
  uint8_t hue = animPhase >> 8;
  CRGB base = colorValue(settings.color);

  switch (settings.effect) {
    case FX_SOLID:
      fill_solid(leds, LED_COUNT, base);
      break;
    case FX_RAINBOW:
      fill_rainbow(leds, LED_COUNT, hue, LED_COUNT > 1 ? 255 / LED_COUNT : 0);
      break;
    case FX_HUE_CYCLE:
      fill_solid(leds, LED_COUNT, CHSV(hue, 255, 255));
      break;
    case FX_BREATHE:
      base.nscale8_video(BREATHE_FLOOR + scale8(cubicwave8(hue), 255 - BREATHE_FLOOR));
      fill_solid(leds, LED_COUNT, base);
      break;
    case FX_CHASE: {
      uint8_t offset = (animPhase >> 12) % 3;
      CRGB dim = base;
      dim.nscale8_video(CHASE_DIM);
      for (uint8_t i = 0; i < LED_COUNT; i++) leds[i] = (i + 3 - offset) % 3 == 0 ? base : dim;
      break;
    }
  }
  // No OLED found (wiring or OLED_I2C_ADDR): blink the first pixel red.
  if (!displayOk) leds[0] = (now / 500) % 2 ? CRGB::Red : CRGB::Black;
  FastLED.show();
}

// ============================================================ Main

void setup() {
  pinMode(JOY_SW_PIN, INPUT_PULLUP);

  loadSettings();
  calibrateJoystick();
  int raw = analogRead(SLIDER_PIN);
  sliderFilt = (SLIDER_INVERT ? 1023 - raw : raw) * 4;
  sliderPos = sliderPrev = sliderFilt >> 4;

  FastLED.addLeds<LED_CHIPSET, LED_DATA_PIN, LED_COLOR_ORDER>(leds, LED_COUNT)
      .setCorrection(TypicalLEDStrip);
  FastLED.setMaxPowerInVoltsAndMilliamps(5, LED_MAX_MILLIAMPS);
  FastLED.clear(true);

  keypad.setDebounceTime(20);

  Wire.begin();
  displayOk = display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR);
  if (displayOk) Wire.setClock(400000);

  splashStart = lastFrameAt = lastInputAt = millis();
}

void loop() {
  uint32_t now = millis();

  Input in = pollJoystick(now);
  if (pollButton(now)) in = IN_SELECT;
  if (in != IN_NONE) {
    lastInputAt = now;
    handleInput(in);
  }

  char key = keypad.getKey();
  if (key != NO_KEY) {
    lastInputAt = now;
    handleKey(key);
  }

  bool unlocked = screen != SCR_SPLASH && screen != SCR_LOCK;
  pollSlider(unlocked);

  if (screen == SCR_SPLASH && now - splashStart >= SPLASH_MS) finishSplash();
#if AUTO_LOCK_MS > 0
  if (unlocked && now - lastInputAt >= AUTO_LOCK_MS) lock();
#endif
  if (lockoutUntil != 0 && !active(lockoutUntil, now)) {
    lockoutUntil = 0;
    redraw = true;
  }

  if (now - lastFrameAt >= LED_FRAME_MS) {
    renderLeds(now, now - lastFrameAt);
    lastFrameAt = now;
  }

  // Redraw on change (rate-limited), plus a slow refresh for countdowns and expiring
  // messages; the splash animates faster.
  uint32_t sinceDraw = now - lastDrawAt;
  uint32_t refresh = screen == SCR_SPLASH ? 40 : 250;
  if (displayOk && ((redraw && sinceDraw >= 30) || sinceDraw >= refresh)) {
    drawScreen(now);
    lastDrawAt = now;
    redraw = false;
  }

  if (settingsDirty && now - settingsDirtyAt >= SETTINGS_SAVE_DELAY_MS) saveSettings();
}
