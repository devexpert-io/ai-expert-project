import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE_NAME } from "../../lib/auth";
import { formatPrice } from "../../lib/format-price";
import { getSessionUser } from "../../lib/server/auth";
import {
  getUserOrders,
  isSupportedOrderStatus,
  ORDER_STATUS_LABELS,
} from "../../lib/server/orders";

import styles from "./orders-page.module.css";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeZone: "Europe/Madrid",
});

function statusClassName(status: keyof typeof ORDER_STATUS_LABELS): string {
  switch (status) {
    case "PAID":
      return styles.statusPaid;
    case "CANCELLED":
      return styles.statusCancelled;
    case "PENDING_PAYMENT":
      return styles.statusPending;
  }
}

export default async function OrdersPage() {
  const cookieStore = await cookies();
  const authToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!authToken) {
    redirect("/checkout");
  }

  const user = await getSessionUser(authToken);
  if (!user) {
    redirect("/checkout");
  }

  const orders = (await getUserOrders(user.id)).filter((order) =>
    isSupportedOrderStatus(order.status),
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Tu historial</p>
        <h1 className={styles.title}>Mis pedidos</h1>
        <p className={styles.intro}>
          Consulta el estado, el importe y la fecha de tus compras.
        </p>
      </header>

      {orders.length === 0 ? (
        <section
          aria-labelledby="orders-empty-title"
          className={styles.empty}
          role="status"
        >
          <h2 id="orders-empty-title">Aún no tienes pedidos</h2>
          <p>Cuando completes una compra, aparecerá aquí.</p>
          <Link className={styles.catalogLink} href="/">
            Explorar catálogo
          </Link>
        </section>
      ) : (
        <section aria-labelledby="orders-list-title" className={styles.listSection}>
          <div className={styles.sectionHeading}>
            <h2 id="orders-list-title">Tus compras</h2>
            <p>{orders.length} {orders.length === 1 ? "pedido" : "pedidos"}</p>
          </div>
          <ul aria-label="Pedidos" className={styles.list}>
            {orders.map((order) => {
              if (!isSupportedOrderStatus(order.status)) {
                return null;
              }

              const status = order.status;
              return (
                <li className={styles.listItem} key={order.id}>
                  <article className={styles.order}>
                    <div className={styles.orderHeader}>
                      <h3 className={styles.orderTitle}>Pedido</h3>
                      <span className={`${styles.status} ${statusClassName(status)}`}>
                        {ORDER_STATUS_LABELS[status]}
                      </span>
                    </div>
                    <dl className={styles.details}>
                      <div>
                        <dt>Estado</dt>
                        <dd>{ORDER_STATUS_LABELS[status]}</dd>
                      </div>
                      <div>
                        <dt>Total</dt>
                        <dd>{formatPrice(order.totalCents)}</dd>
                      </div>
                      <div>
                        <dt>Fecha</dt>
                        <dd>{dateFormatter.format(order.createdAt)}</dd>
                      </div>
                    </dl>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
