import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AUTH_COOKIE_NAME } from "../../../lib/auth";
import { formatPrice } from "../../../lib/format-price";
import { getSessionUser } from "../../../lib/server/auth";
import {
  getUserOrderDetail,
  type UserOrderDetail,
} from "../../../lib/server/order-detail";
import { ORDER_STATUS_LABELS } from "../../../lib/server/orders";

import styles from "./orders-detail-page.module.css";

export const dynamic = "force-dynamic";

type OrderDetailPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

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

function OrderSummary({ order }: { order: UserOrderDetail }) {
  return (
    <dl className={styles.summary}>
      <div>
        <dt>Estado</dt>
        <dd>
          <span className={`${styles.status} ${statusClassName(order.status)}`}>
            {ORDER_STATUS_LABELS[order.status]}
          </span>
        </dd>
      </div>
      <div>
        <dt>Fecha</dt>
        <dd>{dateFormatter.format(order.createdAt)}</dd>
      </div>
      <div>
        <dt>Total</dt>
        <dd>{formatPrice(order.totalCents)}</dd>
      </div>
    </dl>
  );
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const cookieStore = await cookies();
  const authToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!authToken) {
    redirect("/checkout");
  }

  const user = await getSessionUser(authToken);
  if (!user) {
    redirect("/checkout");
  }

  const { id } = await params;
  const order = await getUserOrderDetail(user.id, id);

  if (!order) {
    notFound();
  }

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/orders">
        Volver a Mis pedidos
      </Link>

      <header className={styles.header}>
        <p className={styles.eyebrow}>Tu historial</p>
        <h1 className={styles.title}>Detalle del pedido</h1>
        <p className={styles.intro}>
          Aquí tienes el resumen de los artículos y precios de tu compra.
        </p>
        <OrderSummary order={order} />
      </header>

      <section aria-labelledby="order-lines-title" className={styles.linesSection}>
        <div className={styles.sectionHeading}>
          <h2 id="order-lines-title">Artículos del pedido</h2>
          <p>
            {order.lines.length} {order.lines.length === 1 ? "línea" : "líneas"}
          </p>
        </div>
        <ol aria-label="Líneas del pedido" className={styles.lines}>
          {order.lines.map((line, index) => (
            <li className={styles.lineItem} key={`${line.productName}-${index}`}>
              <article className={styles.line}>
                <div className={styles.lineHeader}>
                  <div>
                    <p className={styles.lineEyebrow}>Artículo {index + 1}</p>
                    <h3 className={styles.productName}>{line.productName}</h3>
                  </div>
                  <p className={styles.lineTotal}>{formatPrice(line.lineTotalCents)}</p>
                </div>
                <dl className={styles.lineDetails}>
                  <div>
                    <dt>Talla</dt>
                    <dd>{line.size}</dd>
                  </div>
                  <div>
                    <dt>Color</dt>
                    <dd>{line.color}</dd>
                  </div>
                  <div>
                    <dt>Cantidad</dt>
                    <dd>{line.quantity}</dd>
                  </div>
                  <div>
                    <dt>Precio unitario</dt>
                    <dd>{formatPrice(line.unitPriceCents)}</dd>
                  </div>
                </dl>
              </article>
            </li>
          ))}
        </ol>
      </section>

      <aside aria-label="Resumen del pedido" className={styles.totalSummary}>
        <p>Total del pedido</p>
        <strong>{formatPrice(order.totalCents)}</strong>
      </aside>
    </main>
  );
}

