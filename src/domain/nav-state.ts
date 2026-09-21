/**
 * Navigation open-state reducer — dropdown control (pure core).
 *
 * The Navigation_Bar allows at most one Dropdown_Menu to be open at any time:
 * opening a menu makes it the open one, and opening a different menu implicitly
 * closes the previously open one (Requirement 1.5). This reducer captures that
 * rule as a pure function so it can be property-tested (Property 4) independently
 * of the rendered NavigationBar component (task 11.1), which owns the DOM and
 * keyboard wiring and delegates state changes here.
 *
 * The open state is represented as the id of the currently open menu, or `null`
 * when no menu is open. Representing "at most one open" as a single optional id
 * (rather than, say, a set of booleans) makes the invariant true by construction.
 */

/** The open-state of the navigation dropdowns: the open menu's id, or null. */
export type NavOpenState = {
  /** Id of the currently open dropdown menu, or `null` if none is open. */
  openMenuId: string | null;
};

/** Actions that drive the navigation open-state reducer. */
export type NavAction =
  /** Open the given menu, making it the sole open menu. */
  | { type: "open"; menuId: string }
  /** Close the given menu only if it is the one currently open. */
  | { type: "close"; menuId: string }
  /** Close whatever menu is open (e.g. on outside click / Escape). */
  | { type: "closeAll" }
  /**
   * Toggle the given menu: open it if closed (or if a different menu is open),
   * otherwise close it.
   */
  | { type: "toggle"; menuId: string };

/** The initial open-state: no dropdown open. */
export const initialNavOpenState: NavOpenState = { openMenuId: null };

/**
 * Reduce the navigation open-state for a single action.
 *
 * Requirement 1.5 / Property 4: at most one dropdown is open at any time. Because
 * the state stores a single optional menu id, opening any menu necessarily makes
 * it the only open menu — opening a different menu replaces (and thus closes) the
 * previous one.
 *
 * @param state  current open-state
 * @param action the action to apply
 * @returns the next open-state
 */
export function navReducer(
  state: NavOpenState,
  action: NavAction,
): NavOpenState {
  switch (action.type) {
    case "open":
      // Opening a menu makes it the sole open menu; any previously open menu is
      // replaced (i.e. closed) by construction.
      return { openMenuId: action.menuId };
    case "close":
      // Only close if the targeted menu is the one currently open; otherwise the
      // state is unaffected.
      return state.openMenuId === action.menuId
        ? { openMenuId: null }
        : state;
    case "closeAll":
      return state.openMenuId === null ? state : { openMenuId: null };
    case "toggle":
      return state.openMenuId === action.menuId
        ? { openMenuId: null }
        : { openMenuId: action.menuId };
    default: {
      // Exhaustiveness guard: if a new action type is added, this line will
      // fail to type-check, prompting the reducer to handle it.
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

/** Whether the given menu is currently the open one. */
export function isMenuOpen(state: NavOpenState, menuId: string): boolean {
  return state.openMenuId === menuId;
}
