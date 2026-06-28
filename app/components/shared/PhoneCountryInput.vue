<script setup lang="ts">
type CountryCode = {
  name: string
  iso2: string
  dialCode: string
  example: string
  flagUrl: string
}

const fallbackCountries: CountryCode[] = [
  { name: 'Bolivia', iso2: 'BO', dialCode: '+591', example: '71234567', flagUrl: '/flags/bo.svg' },
  { name: 'Peru', iso2: 'PE', dialCode: '+51', example: '987654321', flagUrl: '/flags/pe.svg' },
  { name: 'Brasil', iso2: 'BR', dialCode: '+55', example: '11987654321', flagUrl: '/flags/br.svg' },
]

const props = withDefaults(defineProps<{
  modelValue?: string
  countryDialCode?: string
  phone?: string
  inputId?: string
  name?: string
  autocomplete?: string
  required?: boolean
  disabled?: boolean
}>(), {
  modelValue: undefined,
  countryDialCode: undefined,
  phone: undefined,
  inputId: 'phone',
  name: 'phone',
  autocomplete: 'tel',
  required: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:countryDialCode': [value: string]
  'update:phone': [value: string]
}>()

const { data: countryData } = await useFetch<{ countries: CountryCode[] }>('/api/metadata/country-codes', {
  default: () => ({ countries: fallbackCountries }),
})

const countryOptions = computed(() => {
  const countries = countryData.value?.countries
  return countries?.length ? countries : fallbackCountries
})

function splitFullPhone(value?: string) {
  const cleanValue = (value ?? '').trim()
  const digitsValue = onlyPhoneDigits(cleanValue)
  const defaultCountry = countryOptions.value[0] ?? fallbackCountries[0]!
  const country = [...countryOptions.value]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((option) => {
      const dialDigits = onlyPhoneDigits(option.dialCode)
      return cleanValue.startsWith(option.dialCode) || digitsValue.startsWith(dialDigits)
    })
    ?? defaultCountry
  const dialDigits = onlyPhoneDigits(country.dialCode)

  return {
    dialCode: country.dialCode,
    phone: cleanValue.startsWith(country.dialCode)
      ? cleanValue.slice(country.dialCode.length).trim()
      : digitsValue.startsWith(dialDigits)
        ? digitsValue.slice(dialDigits.length)
        : cleanValue,
  }
}

function onlyPhoneDigits(value: string) {
  return value.replace(/\D/g, '')
}

function countryByDialCode(value?: string) {
  return countryOptions.value.find(country => country.dialCode === value)
    ?? countryOptions.value[0]
    ?? fallbackCountries[0]!
}

const dialCodeModel = computed({
  get() {
    return props.countryDialCode ?? splitFullPhone(props.modelValue).dialCode
  },
  set(value: string) {
    emit('update:countryDialCode', value)
    emit('update:modelValue', phoneModel.value ? `${value}${onlyPhoneDigits(phoneModel.value)}` : '')
  },
})

const phoneModel = computed({
  get() {
    return props.phone ?? splitFullPhone(props.modelValue).phone
  },
  set(value: string) {
    // Con modelos separados, el prefijo ya se administra en countryDialCode.
    // Solo el modelo combinado necesita detectar y separar un prefijo pegado.
    if (props.phone !== undefined) {
      emit('update:phone', value)
      emit('update:modelValue', value.trim() ? `${dialCodeModel.value}${onlyPhoneDigits(value)}` : '')
      return
    }

    const splitValue = splitFullPhone(value)
    const phone = splitValue.phone

    if (splitValue.dialCode !== dialCodeModel.value) {
      emit('update:countryDialCode', splitValue.dialCode)
    }

    emit('update:phone', phone)
    emit('update:modelValue', phone.trim() ? `${splitValue.dialCode}${onlyPhoneDigits(phone)}` : '')
  },
})

const phonePlaceholder = computed(() => countryByDialCode(dialCodeModel.value).example)

function updatePhone(event: Event) {
  phoneModel.value = (event.target as HTMLInputElement).value
}
</script>

<template>
  <div class="phone-country-input">
    <div class="phone-country-input__prefix">
      <Select
        v-model="dialCodeModel"
        :options="countryOptions"
        option-label="name"
        option-value="dialCode"
        aria-label="Codigo de pais"
        class="phone-country-input__select"
        :disabled="disabled"
      >
        <template #value="{ value }">
          <span class="phone-country-input__value">
            <img :src="countryByDialCode(value).flagUrl" alt="" aria-hidden="true">
            <span>{{ value }}</span>
          </span>
        </template>
        <template #option="{ option }">
          <span class="phone-country-input__option">
            <img :src="option.flagUrl" alt="" aria-hidden="true">
            <strong>{{ option.dialCode }}</strong>
            <span>{{ option.name }}</span>
          </span>
        </template>
      </Select>
    </div>

    <input
      :id="inputId"
      :value="phoneModel"
      class="phone-country-input__number"
      type="tel"
      inputmode="tel"
      pattern="[0-9 ]*"
      :placeholder="phonePlaceholder"
      :name="name"
      :autocomplete="autocomplete"
      :required="required"
      :disabled="disabled"
      @input="updatePhone"
    />
  </div>
</template>

<style scoped>
.phone-country-input {
  min-height: 44px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  border: 1.5px solid #dce5df;
  border-radius: 12px;
  background: #ffffff;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.phone-country-input__prefix {
  display: flex;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 10px 0 0 10px;
  background: #f1f8f3;
}

.phone-country-input__select {
  min-width: 124px;
  height: 100%;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.phone-country-input__select :deep(.p-select-label) {
  display: inline-flex;
  align-items: center;
  padding: 0 6px 0 12px;
  color: #087a28;
  font-size: 0.9rem;
  font-weight: 900;
}

.phone-country-input__select :deep(.p-select-dropdown) {
  width: 24px;
  color: #087a28;
}

.phone-country-input__value,
.phone-country-input__option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.phone-country-input__value {
  color: #087a28;
  font-weight: 900;
}

.phone-country-input__option {
  gap: 10px;
}

.phone-country-input__option strong {
  color: #087a28;
}

.phone-country-input__value img,
.phone-country-input__option img {
  width: 22px;
  height: 16px;
  border-radius: 3px;
  object-fit: cover;
  box-shadow: 0 0 0 1px rgba(11, 31, 58, 0.1);
}

.phone-country-input__number {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 0 14px;
  border: 0 !important;
  border-left: 1px solid #dce5df !important;
  border-radius: 0 10px 10px 0 !important;
  color: #0b1f3a;
  background: #ffffff !important;
  font-size: 0.92rem;
  font-weight: 700;
  box-shadow: none !important;
}

.phone-country-input:focus-within .phone-country-input__prefix,
.phone-country-input:focus-within .phone-country-input__number {
  border-color: rgba(11, 152, 47, 0.24);
}

.phone-country-input:focus-within {
  border-color: #0b982f;
  box-shadow: 0 0 0 4px rgba(11, 152, 47, 0.12);
  transform: translateY(-1px);
}
</style>
