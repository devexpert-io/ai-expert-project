import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "../../lib/auth";
import {
  CART_COOKIE_NAME,
  type CartView,
} from "../../lib/cart";
import { formatPrice } from "../../lib/format-price";
import { getGuestCart, getUserCart } from "../../lib/server/cart";
import { getSessionUser } from "../../lib/server/auth";
import { CartItemControls } from "../../components/cart/CartItemControls";

import styles from "./cart-page.module.css";

export const dynamic = "force-dynamic";

const EMPTY_CART: CartView = {
  items: [],
  itemCount: 0,
  subtotalCents: 0,
};

function productHref(productSlug: string, size: string, color: string): string {
  const params = new URLSearchParams({ size, color });
  return `/products/${productSlug}?${params.toString()}`;
}

export default async function CartPage() {
  const cookieStore = await cookies();
  const authToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  let userId: string | null = null;
  if (authToken) {
    try {
      userId = (await getSessionUser(authToken))?.id ?? null;
    } catch {
      userId = null;
    }
  }
  const guestToken = cookieStore.get(CART_COOKIE_NAME)?.value;
  const cart = userId
    ? await getUserCart(userId)
    : guestToken
      ? await getGuestCart(guestToken)
      : EMPTY_CART;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Compra pausada</p>
        <h1 className={styles.title}>Tu carrito</h1>
        <p className={styles.intro}>
          Revisa las variantes que has guardado y ajusta las cantidades antes de
          continuar.
        </p>
      </header>

      {cart.items.length === 0 ? (
        <section
          aria-labelledby="cart-empty-title"
          aria-live="polite"
          className={styles.empty}
          role="status"
        >
          <h2 id="cart-empty-title">Tu carrito está vacío</h2>
          <p>Explora la colección para guardar una variante.</p>
          <Link className={styles.catalogLink} href="/">
            Explorar catálogo
          </Link>
        </section>
      ) : (
        <div className={styles.layout}>
          <section aria-labelledby="cart-items-title" className={styles.itemsSection}>
            <div className={styles.sectionHeading}>
              <h2 id="cart-items-title">Variantes guardadas</h2>
              <p>{cart.itemCount} {cart.itemCount === 1 ? "unidad" : "unidades"}</p>
            </div>
            <ul className={styles.items}>
              {cart.items.map((item, index) => (
                <li className={styles.item} key={item.variantId}>
                  <Link
                    aria-label={`Ver ${item.productName}`}
                    className={styles.productLink}
                    href={productHref(item.productSlug, item.size, item.color)}
                  >
                    <div className={styles.imageFrame}>
                      <Image
                        alt={`Imagen de ${item.productName}`}
                        className={styles.image}
                        fill
                        priority={index === 0}
                        sizes="(max-width: 699px) 34vw, 180px"
                        src={item.imageUrl}
                      />
                    </div>
                  </Link>
                  <div className={styles.itemDetails}>
                    <div className={styles.itemHeading}>
                      <div>
                        <p className={styles.itemCategory}>Variante</p>
                        <h3>
                          <Link href={productHref(item.productSlug, item.size, item.color)}>
                            {item.productName}
                          </Link>
                        </h3>
                      </div>
                      <p className={styles.lineTotal}>{formatPrice(item.lineTotalCents)}</p>
                    </div>
                    <p className={styles.variantDescription}>
                      Talla {item.size} · {item.color} · {formatPrice(item.unitPriceCents)} por unidad
                    </p>
                    <CartItemControls
                      productName={item.productName}
                      quantity={item.quantity}
                      variantId={item.variantId}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <aside aria-label="Resumen del carrito" className={styles.summary}>
            <p className={styles.summaryEyebrow}>Resumen</p>
            <dl>
              <div>
                <dt>Unidades</dt>
                <dd>{cart.itemCount}</dd>
              </div>
              <div className={styles.summaryTotal}>
                <dt>Subtotal</dt>
                <dd>{formatPrice(cart.subtotalCents)}</dd>
              </div>
            </dl>
            <p className={styles.summaryNote}>
              Impuestos incluidos · Envío calculado más adelante
            </p>
            <Link className={styles.checkoutLink} href="/checkout">
              Continuar al checkout
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
