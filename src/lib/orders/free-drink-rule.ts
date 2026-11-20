/** The part of the free-drink offer that runs in the browser too: no database here. */
export type FreeDrink = { minPaise: number; choices: { id: string; name: string }[] };

/** True when the food total earns the free drink. */
export const earnsFreeDrink = (subtotalPaise: number, minPaise: number) => minPaise > 0 && subtotalPaise >= minPaise;
