const countryCodes = [
  { name: 'Bolivia', iso2: 'BO', dialCode: '+591', example: '71234567', flagUrl: '/flags/bo.svg' },
  { name: 'Peru', iso2: 'PE', dialCode: '+51', example: '987654321', flagUrl: '/flags/pe.svg' },
  { name: 'Brasil', iso2: 'BR', dialCode: '+55', example: '11987654321', flagUrl: '/flags/br.svg' },
]

export default defineEventHandler(() => ({ countries: countryCodes }))
