"""Seed de dados sintéticos para avaliação funcional do RotaVenda.

Popula todas as tabelas principais respeitando FKs e regras de negócio:
    users, streets, clients, client_streets, products,
    route_templates, route_template_streets, routes, route_streets,
    sales, sale_items, sale_installments, payments, installment_payments.

Objetivo: deixar o banco pronto para uso imediato após `docker-compose up`,
com dados realistas mas 100% fictícios gerados via Faker (pt_BR).

O script é idempotente: se já existirem produtos ou clientes, sai cedo
sem duplicar. Use `docker-compose down -v` para resetar antes de rodar.

Uso:
    cd backend
    python -m app.db.seed_demo
"""

from __future__ import annotations

import random
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from faker import Faker
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.client import Client
from app.models.client_street import ClientStreet
from app.models.installment_payment import InstallmentPayment
from app.models.payment import Payment
from app.models.product import Product
from app.models.route import Route, RouteStatus
from app.models.route_street import RouteStreet, RouteStreetStatus
from app.models.route_template import RouteTemplate, RouteTemplateStreet
from app.models.sale import PaymentMode, Sale, SaleType
from app.models.sale_installment import SaleInstallment
from app.models.sale_item import SaleItem
from app.models.street import Street
from app.models.user import User, UserRole

# Semente fixa — todo mundo que rodar o seed vê os mesmos dados.
RANDOM_SEED = 42
fake = Faker("pt_BR")
Faker.seed(RANDOM_SEED)
random.seed(RANDOM_SEED)

# ---------------------------------------------------------------------------
# Catálogo: 10 ruas fictícias divididas em 2 bairros
# ---------------------------------------------------------------------------

STREETS: list[tuple[str, str, str]] = [
    ("Rua das Acácias", "Jardim Primavera", "00000-001"),
    ("Rua das Palmeiras", "Jardim Primavera", "00000-002"),
    ("Rua dos Ipês", "Jardim Primavera", "00000-003"),
    ("Rua dos Jacarandás", "Jardim Primavera", "00000-004"),
    ("Rua dos Flamboyants", "Jardim Primavera", "00000-005"),
    ("Avenida Central", "Vila Nova", "00000-100"),
    ("Rua das Margaridas", "Vila Nova", "00000-101"),
    ("Rua das Violetas", "Vila Nova", "00000-102"),
    ("Rua dos Girassóis", "Vila Nova", "00000-103"),
    ("Rua das Orquídeas", "Vila Nova", "00000-104"),
]

# ---------------------------------------------------------------------------
# Catálogo: 30 produtos de limpeza/higiene genéricos
# ---------------------------------------------------------------------------

PRODUCTS: list[tuple[str, str, str, str, int]] = [
    # (name, category, unit_measure, price, current_stock)
    ("Detergente Neutro 500ml", "Limpeza", "UN", "3.20", 120),
    ("Detergente Limão 500ml", "Limpeza", "UN", "3.50", 100),
    ("Sabão em Pó 1kg", "Limpeza", "UN", "12.90", 80),
    ("Sabão em Pó 2kg", "Limpeza", "UN", "22.50", 50),
    ("Sabão em Barra 200g", "Limpeza", "UN", "2.40", 200),
    ("Amaciante de Roupas 2L", "Limpeza", "UN", "14.80", 60),
    ("Água Sanitária 1L", "Limpeza", "UN", "6.50", 90),
    ("Água Sanitária 2L", "Limpeza", "UN", "11.00", 60),
    ("Desinfetante Pinho 2L", "Limpeza", "UN", "9.90", 70),
    ("Desinfetante Floral 2L", "Limpeza", "UN", "9.90", 70),
    ("Álcool 70% 1L", "Limpeza", "UN", "8.90", 100),
    ("Álcool em Gel 500g", "Limpeza", "UN", "10.50", 70),
    ("Limpador Multiuso 500ml", "Limpeza", "UN", "5.90", 110),
    ("Limpa Vidros 500ml", "Limpeza", "UN", "7.80", 60),
    ("Lustra Móveis 200ml", "Limpeza", "UN", "7.20", 50),
    ("Sabonete Hidratante 90g", "Higiene", "UN", "2.80", 180),
    ("Sabonete Líquido 250ml", "Higiene", "UN", "8.50", 70),
    ("Shampoo 350ml", "Higiene", "UN", "15.90", 80),
    ("Condicionador 350ml", "Higiene", "UN", "15.90", 80),
    ("Creme Dental 90g", "Higiene", "UN", "4.50", 150),
    ("Escova de Dente Adulto", "Higiene", "UN", "5.20", 120),
    ("Fio Dental 50m", "Higiene", "UN", "6.80", 60),
    ("Papel Higiênico 12 rolos", "Higiene", "PCT", "19.90", 90),
    ("Papel Toalha 2 rolos", "Higiene", "PCT", "9.50", 80),
    ("Esponja Dupla Face", "Utilidades", "UN", "1.80", 200),
    ("Saco de Lixo 30L (20un)", "Utilidades", "PCT", "8.90", 70),
    ("Saco de Lixo 50L (15un)", "Utilidades", "PCT", "10.90", 60),
    ("Pano de Chão", "Utilidades", "UN", "4.50", 100),
    ("Vassoura de Nylon", "Utilidades", "UN", "14.90", 40),
    ("Rodo 40cm", "Utilidades", "UN", "12.50", 40),
]


# ---------------------------------------------------------------------------
# Usuários fixos — cobrem os dois papéis do sistema
# ---------------------------------------------------------------------------

USERS: list[tuple[str, str, str, UserRole]] = [
    ("Gerente Demo", "admin@example.com", "admin123", UserRole.GERENTE),
    ("Vendedor Demo", "vendedor@example.com", "vendedor123", UserRole.VENDEDOR),
]


def _seed_streets(db: Session) -> list[Street]:
    existing = db.query(Street).count()
    if existing > 0:
        print(f"  {existing} ruas já existem — reutilizando.")
        return db.query(Street).order_by(Street.created_at).all()

    streets = [Street(name=n, neighborhood=bg, cep=cep) for n, bg, cep in STREETS]
    db.add_all(streets)
    db.flush()
    print(f"  {len(streets)} ruas criadas.")
    return streets


def _seed_products(db: Session) -> list[Product]:
    existing = db.query(Product).count()
    if existing > 0:
        print(f"  {existing} produtos já existem — reutilizando.")
        return db.query(Product).order_by(Product.created_at).all()

    products = [
        Product(
            name=name,
            category=cat,
            unit_measure=unit,
            price=Decimal(price),
            current_stock=stock,
            min_stock=5,
            is_active=True,
        )
        for name, cat, unit, price, stock in PRODUCTS
    ]
    db.add_all(products)
    db.flush()
    print(f"  {len(products)} produtos criados.")
    return products


def _seed_users(db: Session) -> dict[str, User]:
    out: dict[str, User] = {}
    for name, email, password, role in USERS:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            user = User(
                name=name,
                email=email,
                hashed_password=hash_password(password),
                role=role,
                is_active=True,
            )
            db.add(user)
            print(f"  Usuário criado: {email} ({role.value})")
        out[role.value] = user
    db.flush()
    return out


def _seed_clients(db: Session, streets: list[Street]) -> list[Client]:
    existing = db.query(Client).count()
    if existing > 0:
        print(f"  {existing} clientes já existem — reutilizando.")
        return db.query(Client).order_by(Client.created_at).all()

    clients: list[Client] = []
    for i in range(20):
        phone = f"(11) 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}"
        notes = fake.sentence(nb_words=5) if random.random() < 0.4 else None
        client = Client(
            name=fake.name(),
            phone=phone,
            notes=notes,
            is_active=True,
        )
        clients.append(client)
    db.add_all(clients)
    db.flush()

    # Cada cliente aparece em 1-2 ruas
    for idx, client in enumerate(clients):
        primary_street = streets[idx % len(streets)]
        db.add(
            ClientStreet(
                client_id=client.id,
                street_id=primary_street.id,
                house_number=str(random.randint(1, 999)),
                reference=fake.sentence(nb_words=4) if random.random() < 0.3 else None,
                display_order=1,
            )
        )
        if random.random() < 0.25:
            secondary = streets[(idx + 3) % len(streets)]
            if secondary.id != primary_street.id:
                db.add(
                    ClientStreet(
                        client_id=client.id,
                        street_id=secondary.id,
                        house_number=str(random.randint(1, 999)),
                        reference=None,
                        display_order=2,
                    )
                )
    db.flush()
    print(f"  {len(clients)} clientes criados com vínculos a ruas.")
    return clients


def _client_primary_street(db: Session, client: Client) -> Street:
    link = (
        db.query(ClientStreet)
        .filter(ClientStreet.client_id == client.id)
        .order_by(ClientStreet.display_order)
        .first()
    )
    return db.query(Street).filter(Street.id == link.street_id).one()


def _seed_route_template(
    db: Session, streets: list[Street]
) -> RouteTemplate | None:
    existing = db.query(RouteTemplate).first()
    if existing is not None:
        print("  Template de rota já existe — reutilizando.")
        return existing

    template = RouteTemplate(
        name="Rota Semanal — Jardim Primavera",
        description="Template de exemplo cobrindo as 5 ruas principais do bairro.",
        is_active=True,
    )
    db.add(template)
    db.flush()

    primavera = [s for s in streets if s.neighborhood == "Jardim Primavera"][:5]
    for order, street in enumerate(primavera, start=1):
        db.add(
            RouteTemplateStreet(
                template_id=template.id,
                street_id=street.id,
                visit_order=order,
            )
        )
    db.flush()
    print("  Template 'Rota Semanal — Jardim Primavera' criado com 5 ruas.")
    return template


def _seed_active_route(
    db: Session,
    seller: User,
    template: RouteTemplate,
) -> Route:
    today = date.today()
    existing = (
        db.query(Route)
        .filter(Route.seller_id == seller.id, Route.route_date == today)
        .first()
    )
    if existing is not None:
        print("  Rota de hoje já existe — reutilizando.")
        return existing

    now_utc = datetime.now(timezone.utc)
    route = Route(
        seller_id=seller.id,
        name=template.name,
        route_date=today,
        status=RouteStatus.IN_PROGRESS,
        started_at=now_utc.replace(hour=8, minute=0, second=0, microsecond=0),
        notes="Rota em andamento — gerada pelo seed.",
        is_active=True,
    )
    db.add(route)
    db.flush()

    # Duplica as ruas do template → route_streets (primeira COMPLETED, resto PENDING)
    for idx, tpl_street in enumerate(template.streets):
        if idx == 0:
            status = RouteStreetStatus.COMPLETED
            started = now_utc.replace(hour=8, minute=15)
            completed = now_utc.replace(hour=9, minute=30)
        elif idx == 1:
            status = RouteStreetStatus.IN_PROGRESS
            started = now_utc.replace(hour=9, minute=45)
            completed = None
        else:
            status = RouteStreetStatus.PENDING
            started = None
            completed = None
        db.add(
            RouteStreet(
                route_id=route.id,
                street_id=tpl_street.street_id,
                visit_order=tpl_street.visit_order,
                status=status,
                started_at=started,
                completed_at=completed,
            )
        )
    db.flush()
    print(f"  Rota ativa criada para {today}.")
    return route


def _build_sale(
    db: Session,
    *,
    client: Client,
    seller: User,
    route_street_id,
    sale_date: date,
    sale_type: SaleType,
    payment_mode: PaymentMode,
    products: list[Product],
    description: str | None = None,
) -> Sale:
    """Cria uma venda com 1-4 itens aleatórios. Retorna a Sale já flushed."""
    sample_size = random.randint(1, 4)
    chosen = random.sample(products, sample_size)

    sale = Sale(
        client_id=client.id,
        seller_id=seller.id,
        route_street_id=route_street_id,
        sale_date=sale_date,
        amount=Decimal("0"),  # recalculado abaixo
        discount=Decimal("0"),
        description=description,
        sale_type=sale_type,
        payment_mode=payment_mode,
        is_active=True,
    )
    db.add(sale)
    db.flush()

    total = Decimal("0")
    for product in chosen:
        qty = Decimal(random.randint(1, 3))
        unit = product.price
        subtotal = (qty * unit).quantize(Decimal("0.01"))
        total += subtotal
        db.add(
            SaleItem(
                sale_id=sale.id,
                product_id=product.id,
                quantity=qty,
                unit_price=unit,
                subtotal=subtotal,
            )
        )

    sale.amount = total

    if payment_mode == PaymentMode.FIADO:
        # Parcela única, vence em 30 dias
        db.add(
            SaleInstallment(
                sale_id=sale.id,
                number=1,
                due_date=sale_date + timedelta(days=30),
                amount=total,
                paid_amount=Decimal("0"),
                paid_at=None,
            )
        )
    db.flush()
    return sale


def _seed_sales(
    db: Session,
    *,
    clients: list[Client],
    seller: User,
    gerente: User,
    route: Route,
    products: list[Product],
) -> list[Sale]:
    if db.query(Sale).count() > 0:
        print("  Vendas já existem — reutilizando.")
        return db.query(Sale).all()

    today = date.today()
    sales: list[Sale] = []
    route_streets = list(route.route_streets)

    # Mapa cliente → (rota, route_street) quando a rua do cliente coincide com a rota
    client_to_rs: dict[Client, RouteStreet] = {}
    for client in clients:
        primary = _client_primary_street(db, client)
        for rs in route_streets:
            if rs.street_id == primary.id:
                client_to_rs[client] = rs
                break

    rota_clients = [c for c in clients if c in client_to_rs]
    loja_clients = [c for c in clients if c not in client_to_rs]

    # 15 vendas: 9 na rota + 6 na loja. 7 A_VISTA + 8 FIADO.
    plan: list[tuple[SaleType, PaymentMode, int]] = [
        # (tipo, modo, dias_atras)
        (SaleType.ROTA, PaymentMode.A_VISTA, 0),
        (SaleType.ROTA, PaymentMode.A_VISTA, 0),
        (SaleType.ROTA, PaymentMode.A_VISTA, 1),
        (SaleType.ROTA, PaymentMode.FIADO, 0),
        (SaleType.ROTA, PaymentMode.FIADO, 1),
        (SaleType.ROTA, PaymentMode.FIADO, 3),
        (SaleType.ROTA, PaymentMode.FIADO, 5),
        (SaleType.ROTA, PaymentMode.FIADO, 10),
        (SaleType.ROTA, PaymentMode.FIADO, 15),
        (SaleType.LOJA, PaymentMode.A_VISTA, 0),
        (SaleType.LOJA, PaymentMode.A_VISTA, 2),
        (SaleType.LOJA, PaymentMode.A_VISTA, 4),
        (SaleType.LOJA, PaymentMode.A_VISTA, 7),
        (SaleType.LOJA, PaymentMode.FIADO, 2),
        (SaleType.LOJA, PaymentMode.FIADO, 8),
    ]

    for sale_type, mode, days_ago in plan:
        sale_date = today - timedelta(days=days_ago)
        if sale_type == SaleType.ROTA and rota_clients:
            client = random.choice(rota_clients)
            rs = client_to_rs[client]
            # Só vincula à route_street quando a venda é de hoje e a rua está ativa
            rs_id = rs.id if days_ago == 0 else None
            who = seller
            desc = "Venda realizada na rota."
        else:
            pool = loja_clients or clients
            client = random.choice(pool)
            rs_id = None
            who = random.choice([seller, gerente])
            desc = "Venda realizada na loja."

        sale = _build_sale(
            db,
            client=client,
            seller=who,
            route_street_id=rs_id,
            sale_date=sale_date,
            sale_type=sale_type,
            payment_mode=mode,
            products=products,
            description=desc,
        )
        sales.append(sale)

    n_vista = sum(1 for s in sales if s.payment_mode == PaymentMode.A_VISTA)
    n_fiado = len(sales) - n_vista
    print(f"  {len(sales)} vendas criadas ({n_vista} à vista + {n_fiado} fiado).")
    return sales


def _seed_payments(db: Session, sales: list[Sale], seller: User) -> None:
    """Cria 5 pagamentos aplicados via FIFO em parcelas em aberto.

    Lógica FIFO: para um mesmo cliente, o pagamento paga primeiro a parcela
    mais antiga em aberto (due_date ASC, number ASC), consumindo o saldo.
    Se sobrar valor, segue para a próxima parcela do mesmo cliente.
    """
    if db.query(Payment).count() > 0:
        print("  Pagamentos já existem — reutilizando.")
        return

    today = date.today()

    # Agrupa parcelas em aberto por cliente (FIFO por due_date, number)
    open_by_client: dict = {}
    for sale in sales:
        if sale.payment_mode != PaymentMode.FIADO:
            continue
        for inst in sale.installments:
            if inst.paid_amount < inst.amount:
                open_by_client.setdefault(sale.client_id, []).append(inst)
    for lst in open_by_client.values():
        lst.sort(key=lambda i: (i.due_date, i.number))

    # Escolhe 5 clientes diferentes com dívida em aberto (se possível)
    candidate_clients = list(open_by_client.keys())
    random.shuffle(candidate_clients)
    selected = candidate_clients[:5]

    if len(selected) < 5:
        print(
            f"  Aviso: só havia {len(selected)} cliente(s) com parcelas em aberto."
        )

    payments_created = 0
    for client_id in selected:
        installments = open_by_client[client_id]
        if not installments:
            continue

        first = installments[0]
        # Paga 40% da primeira parcela (parcial — deixa a dívida em aberto)
        pay_amount = (first.amount * Decimal("0.4")).quantize(Decimal("0.01"))
        if pay_amount <= Decimal("0"):
            continue

        payment = Payment(
            client_id=client_id,
            seller_id=seller.id,
            route_street_id=None,
            payment_date=today,
            amount=pay_amount,
            notes="Pagamento parcial.",
            is_active=True,
        )
        db.add(payment)
        db.flush()

        # Aplica FIFO
        remaining = pay_amount
        for inst in installments:
            if remaining <= Decimal("0"):
                break
            available = inst.amount - inst.paid_amount
            if available <= Decimal("0"):
                continue
            apply_amount = min(available, remaining)
            db.add(
                InstallmentPayment(
                    installment_id=inst.id,
                    payment_id=payment.id,
                    amount=apply_amount,
                )
            )
            inst.paid_amount = inst.paid_amount + apply_amount
            if inst.paid_amount >= inst.amount:
                inst.paid_at = datetime.now(timezone.utc)
            remaining -= apply_amount

        payments_created += 1

    db.flush()
    print(f"  {payments_created} pagamentos criados via FIFO.")


def seed(db: Session | None = None) -> None:
    """Ponto de entrada principal. Idempotente — seguro rodar múltiplas vezes."""
    close = db is None
    if db is None:
        db = SessionLocal()

    try:
        print("\n[seed_demo] === Iniciando seed sintético ===")

        print("\n[1/7] Ruas")
        streets = _seed_streets(db)

        print("\n[2/7] Produtos")
        products = _seed_products(db)

        print("\n[3/7] Usuários")
        users = _seed_users(db)
        gerente = users[UserRole.GERENTE.value]
        vendedor = users[UserRole.VENDEDOR.value]

        print("\n[4/7] Clientes + vínculos")
        clients = _seed_clients(db, streets)

        print("\n[5/7] Template e rota ativa")
        template = _seed_route_template(db, streets)
        route = _seed_active_route(db, vendedor, template)

        print("\n[6/7] Vendas (15 mistas)")
        sales = _seed_sales(
            db,
            clients=clients,
            seller=vendedor,
            gerente=gerente,
            route=route,
            products=products,
        )

        print("\n[7/7] Pagamentos (FIFO)")
        _seed_payments(db, sales, vendedor)

        db.commit()
        print("\n[seed_demo] === Seed concluído com sucesso ===\n")
        print("Login:")
        print("  Gerente:  admin@example.com     / admin123")
        print("  Vendedor: vendedor@example.com  / vendedor123\n")

    except Exception:
        db.rollback()
        raise
    finally:
        if close:
            db.close()


if __name__ == "__main__":
    seed()
    sys.exit(0)
