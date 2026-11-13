import { useCallback, useEffect, useState } from 'react'

export function usePricingPlans() {
  const [plans, setPlans] = useState([])
  const [categories, setCategories] = useState([])
  const [currency, setCurrency] = useState('IDR')
  const [priceState, setPriceState] = useState('loading')

  const loadPlans = useCallback(async () => {
    setPriceState('loading')
    try {
      const response = await fetch('/api/pricing.php')
      if (!response.ok) {
        throw new Error(`Pricing API returned ${response.status}`)
      }

      const result = await response.json()
      if (!Array.isArray(result.plans) || !result.currency) {
        throw new Error('Pricing API returned an invalid response')
      }

      setPlans(result.plans)
      setCategories(Array.isArray(result.categories) ? result.categories : [])
      setCurrency(result.currency)
      setPriceState('ready')
    } catch (error) {
      console.error('Unable to load pricing plans:', error)
      setPriceState('error')
    }
  }, [])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  return { plans, categories, currency, priceState, loadPlans }
}
