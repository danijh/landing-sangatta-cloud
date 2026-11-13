import { useState } from 'react'
import { ArrowUpRight, Check, UsersRound } from 'lucide-react'
import { formatPrice, formatPriceParts } from '../content/siteContent.js'
import { usePricingPlans } from './usePricingPlans.js'

export default function PricingSection({ t, locale }) {
  const [billing, setBilling] = useState('monthly')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [slideDirection, setSlideDirection] = useState('next')
  const { plans, categories, currency, priceState, loadPlans } = usePricingPlans()

  const category = categories.some((item) => item.id === selectedCategory) ? selectedCategory : categories[0]?.id ?? null
  const selectCategory = (id) => {
    const from = categories.findIndex((item) => item.id === category)
    const to = categories.findIndex((item) => item.id === id)
    setSlideDirection(to < from ? 'prev' : 'next')
    setSelectedCategory(id)
  }

  return (
    <section className="section-space pricing-section" id="paket">
      <div className="site-container">
        <div className="section-heading mx-auto max-w-[650px] text-center">
          <span className="section-eyebrow">{t.pricingEyebrow}</span>
          <h2>{t.pricingTitle}</h2>
          <p>{t.pricingBody}</p>
        </div>
        <div className="billing-toggle mt-8">
          <button
            className={billing === 'monthly' ? 'billing-option active' : 'billing-option'}
            type="button"
            onClick={() => setBilling('monthly')}
          >
            {t.monthly}
          </button>
          <button
            className={billing === 'yearly' ? 'billing-option active' : 'billing-option'}
            type="button"
            onClick={() => setBilling('yearly')}
          >
            {t.yearly}<span className="save-pill">{t.save}</span>
          </button>
        </div>

        {categories.length > 1 && (
          <div className="billing-toggle category-toggle mt-4" role="tablist" aria-label="Category">
            {categories.map((item) => (
              <button
                className={category === item.id ? 'billing-option active' : 'billing-option'}
                type="button"
                role="tab"
                aria-selected={category === item.id}
                key={item.id}
                onClick={() => selectCategory(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
        )}

        {priceState === 'loading' && (
          <p className="pricing-feedback" role="status">{t.loading}</p>
        )}
        {priceState === 'error' && (
          <div className="pricing-feedback pricing-error" role="alert">
            <span>{t.loadError}</span>
            <button type="button" onClick={loadPlans}>{t.retry}</button>
          </div>
        )}
        {priceState === 'ready' && (
          <div className={`plan-grid pager-${slideDirection}`} key={category}>
            {plans.filter((plan) => category === null || plan.category_id === category).map((plan, index) => {
              const isYearly = billing === 'yearly'
              const localizedPlan = plan.translations?.[locale] ?? plan
              const planFeatures = localizedPlan.features ?? plan.features ?? []
              const price = formatPrice(
                isYearly ? plan.annual_price : plan.monthly_price,
                currency,
                locale,
              )
              const mainPrice = formatPriceParts(
                isYearly ? Math.round(plan.annual_price / 12) : plan.monthly_price,
                currency,
                locale,
              )

              return (
                <article
                  className={`plan-card plan-tone-${index % 3} ${plan.featured ? 'plan-card-featured' : ''}`}
                  key={plan.id}
                >
                  {plan.featured && <span className="plan-ribbon">{t.popular}</span>}
                  <div className="flex items-start justify-between">
                    <span className="plan-name">{localizedPlan.name}</span>
                    {plan.storage && <span className="plan-storage">{plan.storage}</span>}
                  </div>
                  <p className="plan-desc mt-3 min-h-10 text-[13px] leading-5">
                    {localizedPlan.description}
                  </p>
                  <div className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
                    <span className="plan-price">
                      <span className="plan-price-text">{mainPrice.currency}</span>
                      <span className="plan-price-value">{mainPrice.value}</span>
                      {mainPrice.unit && <span className="plan-price-text">{mainPrice.unit}</span>}
                    </span>
                    <span className="plan-per text-xs">{t.perMonth}</span>
                  </div>
                  {isYearly ? (
                    <p className="plan-note mt-1 text-[11px]">
                      {price} {t.perYear} · {t.billedYearly}
                    </p>
                  ) : (
                    <p className="plan-note mt-1 text-[11px]">
                      {locale === 'id' ? 'Tagihan bulanan' : 'Billed monthly'}
                    </p>
                  )}
                  <a
                    className={`button mt-6 w-full justify-center ${plan.featured ? 'button-teal' : 'button-outline'}`}
                    href={`/order?plan=${encodeURIComponent(plan.id)}&billing=${billing}`}
                  >
                    {t.choose}
                    <ArrowUpRight size={15} />
                  </a>
                  <div className="plan-divider" />
                  {Number.isInteger(plan.users) && plan.users > 0 && (
                    <div className="plan-user">
                      <UsersRound size={15} />
                      {plan.users} {t.users}
                    </div>
                  )}
                  {planFeatures.length > 0 && (
                    <ul className="mt-4 space-y-3">
                      {planFeatures.map((feature) => (
                        <li className="plan-feature" key={feature}>
                          <span><Check size={12} /></span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
