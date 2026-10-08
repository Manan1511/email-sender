import readXlsxFile from 'read-excel-file/browser'
import type { ContactTable } from './contacts'
import { tableFromMatrix } from './contacts'

export async function readWorkbook(file: File): Promise<Array<{ name: string; table: ContactTable }>> {
  const sheets = await readXlsxFile(file)
  return sheets.filter((sheet) => sheet.data.length > 0).map((sheet) => ({ name: sheet.sheet, table: tableFromMatrix(sheet.data) }))
}
