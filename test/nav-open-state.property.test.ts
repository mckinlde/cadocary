import { describe, expect, test } from "vitest";
import fc from "fast-check";

import {
  initialNavOpenState,
  isMenuOpen,
  navReducer,
  type NavAction,
  type NavOpenState,
} from "../src/domain/nav-state";

/**
 * Feature: website-redesign, Property 4: At most one dropdown menu is open
 *
 * Validates: Requirements 1.5
 *
 * For any sequence of actions (especially "open menu") applied to the navigation
 * open-state reducer starting from the initial state, the number of simultaneously
 * open dropdown menus is always at most one, and after opening a given menu that
 * menu is the open one.
 *
 * The state stores a single optional openMenuId, so "at most one open" is checked
 * against a set of candidate menu ids: across all candidates, at most one ever
 * returns isMenuOpen === true. We also assert that immediately after an "open m"
 * action, isMenuOpen(state, m) holds.
 */
describe("Property 4: At most one dropdown menu is open", () => {
  // A small, fixed pool of candidate menu ids so that "open" actions collide and
  // genuinely exercise the replace-the-open-menu behaviour.
  const menuIds = ["home", "products", "projects", "about", "contact"];

  const actionArb: fc.Arbitrary<NavAction> = fc.oneof(
    fc.record({
      type: fc.constant<"open">("open"),
      menuId: fc.constantFrom(...menuIds),
    }),
    fc.record({
      type: fc.constant<"close">("close"),
      menuId: fc.constantFrom(...menuIds),
    }),
    fc.record({
      type: fc.constant<"toggle">("toggle"),
      menuId: fc.constantFrom(...menuIds),
    }),
    fc.record({ type: fc.constant<"closeAll">("closeAll") }),
  );

  // Bias toward "open" actions so the invariant is stressed under repeated opens.
  const openHeavyActionArb: fc.Arbitrary<NavAction> = fc.oneof(
    { weight: 3, arbitrary: actionArb },
    {
      weight: 2,
      arbitrary: fc.record({
        type: fc.constant<"open">("open"),
        menuId: fc.constantFrom(...menuIds),
      }),
    },
  );

  const countOpen = (state: NavOpenState): number =>
    menuIds.filter((id) => isMenuOpen(state, id)).length;

  test("at most one menu open after any action sequence; opening makes that menu the open one", () => {
    fc.assert(
      fc.property(
        fc.array(openHeavyActionArb, { minLength: 0, maxLength: 50 }),
        (actions) => {
          let state = initialNavOpenState;

          // Initial state: nothing open.
          expect(countOpen(state)).toBe(0);

          for (const action of actions) {
            state = navReducer(state, action);

            // Invariant: across all candidate menus, at most one is open.
            expect(countOpen(state)).toBeLessThanOrEqual(1);

            // After opening a given menu, that menu is the open one.
            if (action.type === "open") {
              expect(isMenuOpen(state, action.menuId)).toBe(true);
              // And it is the *only* open one.
              expect(countOpen(state)).toBe(1);
            }
          }

          // Invariant holds for the final state as well.
          expect(countOpen(state)).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 200 },
    );
  });
});
