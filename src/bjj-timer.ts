// Entry point. Importing this module registers <bjj-timer>.
import { defineBjjTimer } from "./element.js";

export {
  BjjTimerElement,
  BJJ_TIMER_EVENTS,
  CREDIT_TEXT,
  CREDIT_URL,
  defineBjjTimer,
  parseDuration,
  type BjjTimerEventDetail,
  type BjjTimerEventName,
} from "./element.js";
export * from "./logic.js";

defineBjjTimer();
