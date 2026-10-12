import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";

import { CheckoutForm } from "../../components/checkout/CheckoutForm";
import { CART_COOKIE_NAME, type CartView } from "../../lib/cart";
import { formatPrice } from "../../lib/format-price";
import { getGuestCart } from "../../lib/server/cart";

import styles from "./checkout-page.module.css";

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

export default async function CheckoutPage() {
  const cookieStore = await cookies();
  const guestToken = cookieStore.get(CART_COOKIE_NAME)?.value;
  const cart = guestToken ? await getGuestCart(guestToken) : EMPTY_CART;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Antes de pagar</p>
        <h1 className={styles.title}>Checkout</h1>
        <p className={styles.intro}>
          Revisa tu selección y deja tus datos preparados para el siguiente
          paso.
        </p>
      </header>

      {cart.items.length === 0 ? (
        <section
          aria-labelledby="checkout-empty-title"
          aria-live="polite"
          className={styles.empty}
          role="status"
        >
          <h2 id="checkout-empty-title">No hay nada que revisar</h2>
          <p>
            Añade una variante al carrito para preparar tus datos de contacto y
            envío.
          </p>
          <div className={styles.emptyActions}>
            <Link className={styles.primaryLink} href="/cart">
              Ir al carrito
            </Link>
            <Link className={styles.secondaryLink} href="/">
              Explorar catálogo
            </Link>
          </div>
        </section>
      ) : (
        <div className={styles.layout}>
          <section aria-labelledby="checkout-summary-title" className={styles.summary}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionEyebrow}>Tu selección</p>
                <h2 id="checkout-summary-title">Resumen del carrito</h2>
              </div>
              <Link className={styles.editLink} href="/cart">
                Editar carrito
              </Link>
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
                        sizes="(max-width: 699px) 28vw, 120px"
                        src={item.imageUrl}
                      />
                    </div>
                  </Link>
                  <div className={styles.itemDetails}>
                    <h3>
                      <Link href={productHref(item.productSlug, item.size, item.color)}>
                        {item.productName}
                      </Link>
                    </h3>
                    <p>
                      Talla {item.size} · {item.color} · {item.quantity} {item.quantity === 1 ? "unidad" : "unidades"}
                    </p>
                    <p className={styles.itemPrice}>
                      {formatPrice(item.unitPriceCents)} por unidad · {formatPrice(item.lineTotalCents)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className={styles.total}>
              <div>
                <dt>Unidades</dt>
                <dd>{cart.itemCount}</dd>
              </div>
              <div className={styles.totalRow}>
                <dt>Subtotal</dt>
                <dd>{formatPrice(cart.subtotalCents)}</dd>
              </div>
            </dl>
            <p className={styles.totalNote}>
              Impuestos incluidos · Envío calculado más adelante
            </p>
          </section>

          <section aria-labelledby="checkout-details-title" className={styles.details}>
            <p className={styles.sectionEyebrow}>Datos de contacto</p>
            <h2 id="checkout-details-title">Prepara tu envío</h2>
            <CheckoutForm />
          </section>
        </div>
      )}
    </main>
  );
}
