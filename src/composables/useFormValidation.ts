import { computed, unref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

type MaybeRef<T> = T | Ref<T> | ComputedRef<T>

type ValidatorResult = string | null | undefined | boolean

export type ValidatorFn<TValues> = (
  value: unknown,
  values: TValues
) => ValidatorResult

export type FieldRule<TValues> =
  | ValidatorFn<TValues>
  | {
      validate: ValidatorFn<TValues>
      message?: string
    }

export type RulesMap<TValues> = Record<string, FieldRule<TValues>[]>

export type FieldState = {
  valid: boolean
  errors: string[]
}

export type FormState = Record<string, FieldState>

const DEFAULT_ERROR = 'Invalid value'

const toErrorMessage = (result: ValidatorResult, fallback?: string) => {
  if (typeof result === 'string' && result.trim().length > 0) return result
  if (result === false) return fallback ?? DEFAULT_ERROR
  return null
}

const evaluateRule = <TValues>(
  rule: FieldRule<TValues>,
  value: unknown,
  values: TValues
) => {
  if (typeof rule === 'function') return toErrorMessage(rule(value, values))
  return toErrorMessage(rule.validate(value, values), rule.message)
}

export const useFormValidation = <TValues extends Record<string, unknown>>(
  values: MaybeRef<TValues>,
  rules: MaybeRef<RulesMap<TValues>>
) => {
  const valuesRef = computed(() => unref(values) ?? ({} as TValues))
  const rulesRef = computed(() => unref(rules) ?? ({} as RulesMap<TValues>))

  const fields = computed<FormState>(() => {
    const valuesValue = valuesRef.value
    const rulesValue = rulesRef.value
    const keys = new Set([
      ...Object.keys(valuesValue),
      ...Object.keys(rulesValue)
    ])

    const result: FormState = {}

    keys.forEach((key) => {
      const fieldValue = valuesValue[key]
      const fieldRules = rulesValue[key] ?? []
      const errors: string[] = []

      for (const rule of fieldRules) {
        const error = evaluateRule(rule, fieldValue, valuesValue)
        if (error) errors.push(error)
      }

      result[key] = {
        valid: errors.length === 0,
        errors
      }
    })

    return result
  })

  const errors = computed(() => {
    const result: Record<string, string[]> = {}

    for (const [key, state] of Object.entries(fields.value)) {
      result[key] = state.errors
    }

    return result
  })

  const isValid = computed(() =>
    Object.values(fields.value).every((state) => state.valid)
  )

  const getFieldState = (name: keyof TValues | string) =>
    fields.value[String(name)] ?? { valid: true, errors: [] }

  const validateField = (name: keyof TValues | string) =>
    getFieldState(name).valid

  const validateAll = () => isValid.value

  return {
    isValid,
    errors,
    fields,
    getFieldState,
    validateField,
    validateAll
  }
}
