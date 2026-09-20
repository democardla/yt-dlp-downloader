import {
  BoxRenderable,
  Renderable,
  RGBA,
  ScrollBoxRenderable,
  TextRenderable,
  type RenderContext,
  type RenderableOptions,
} from "@opentui/core"

const TABLE_HEADER_FG = RGBA.fromHex("#7FC7FF")

export interface BorderlessTableColumn {
  id: string
  title?: string
  width?: number | `${number}%`
  flexGrow?: number
  minWidth?: number
}

export interface BorderlessTableRow {
  id: string
  cells: Renderable[]
}

export interface BorderlessTableOptions extends RenderableOptions {
  columns: BorderlessTableColumn[]
  header?: boolean
}

/** A reusable table made from borderless flex rows and arbitrary renderables. */
export class BorderlessTableRenderable extends Renderable {
  private readonly columns: BorderlessTableColumn[]
  private readonly header: boolean
  private readonly headerRow: BoxRenderable | null
  private readonly body: ScrollBoxRenderable
  private readonly rows = new Map<string, BoxRenderable>()

  constructor(ctx: RenderContext, options: BorderlessTableOptions) {
    const { columns, header = true, ...rest } = options
    super(ctx, {
      ...rest,
      width: rest.width ?? "100%",
      flexDirection: "column",
    })
    this.columns = columns
    this.header = header

    this.headerRow = header ? this.createHeader(ctx) : null
    if (this.headerRow) this.add(this.headerRow)
    this.body = new ScrollBoxRenderable(ctx, {
      id: `${this.id}-body`,
      width: "100%",
      flexGrow: 1,
      scrollY: true,
      scrollX: false,
      scrollbarOptions: { showArrows: false },
    })
    this.add(this.body)
  }

  private applyColumn(cell: Renderable, column: BorderlessTableColumn): void {
    if (column.width !== undefined) cell.width = column.width
    if (column.flexGrow !== undefined) cell.flexGrow = column.flexGrow
    if (column.minWidth !== undefined) cell.minWidth = column.minWidth
  }

  private createHeader(ctx: RenderContext): BoxRenderable {
    const row = new BoxRenderable(ctx, {
      id: `${this.id}-header`,
      width: "100%",
      height: 1,
      flexDirection: "row",
    })
    this.columns.forEach((column) => {
      const cell = new TextRenderable(ctx, {
        id: `${this.id}-header-${column.id}`,
        content: column.title ?? "",
        height: 1,
        fg: TABLE_HEADER_FG,
        wrapMode: "none",
        truncate: true,
        selectable: false,
      })
      this.applyColumn(cell, column)
      row.add(cell)
    })
    return row
  }

  replaceHeaderCell(columnIndex: number, cell: Renderable): void {
    if (!this.headerRow) return
    const oldCell = this.headerRow.getChildren()[columnIndex]
    if (oldCell) this.headerRow.remove(oldCell.id)
    const column = this.columns[columnIndex]
    if (column) this.applyColumn(cell, column)
    this.headerRow.add(cell, columnIndex)
  }

  private createRow(row: BorderlessTableRow): BoxRenderable {
    const container = new BoxRenderable(this.ctx, {
      id: row.id,
      width: "100%",
      height: 1,
      flexDirection: "row",
    })
    row.cells.forEach((cell, index) => {
      const column = this.columns[index]
      if (column) this.applyColumn(cell, column)
      container.add(cell)
    })
    return container
  }

  setRows(rows: readonly BorderlessTableRow[]): void {
    for (const child of this.body.getChildren()) this.body.remove(child.id)
    this.rows.clear()
    rows.forEach((row) => this.addRow(row))
  }

  addRow(row: BorderlessTableRow): void {
    const current = this.rows.get(row.id)
    if (current) this.body.remove(current.id)
    const container = this.createRow(row)
    this.rows.set(row.id, container)
    this.body.add(container)
  }

  removeRow(rowId: string): void {
    const row = this.rows.get(rowId)
    if (!row) return
    this.body.remove(row.id)
    this.rows.delete(rowId)
  }

  replaceCell(rowId: string, columnIndex: number, cell: Renderable): void {
    const row = this.rows.get(rowId)
    if (!row) return
    const oldCell = row.getChildren()[columnIndex]
    if (oldCell) row.remove(oldCell.id)
    const column = this.columns[columnIndex]
    if (column) this.applyColumn(cell, column)
    row.add(cell, columnIndex)
  }

  getRow(rowId: string): BoxRenderable | null {
    return this.rows.get(rowId) ?? null
  }

  getRowCount(): number {
    return this.rows.size
  }
}
