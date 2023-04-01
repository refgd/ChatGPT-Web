import DefaultRoles from '../assets/defaultRoles.json'
import { isEmptyString } from './is'

interface RoleDescriptions {
  [key: string]: string
}

const defaultRolesList: RoleDescriptions = DefaultRoles

const defaultRolesKey: string[] = []
for (const key in defaultRolesList) {
  if (Object.prototype.hasOwnProperty.call(defaultRolesList, key))
    defaultRolesKey.push(key)
}

export function getRolesKey() {
  return defaultRolesKey
}

export function getSysMessageByKey(key) {
  if (!isEmptyString(key)) {
    if (Object.prototype.hasOwnProperty.call(defaultRolesList, key))
      return defaultRolesList[key]
  }
  return ''
}
