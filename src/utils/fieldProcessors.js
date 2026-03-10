export function IO_field_1_ProcessValue_Trigger(item) {
    var value;
    let DateTime = new Date();
    let LocalTime = DateTime.toLocaleDateString("sk-SK");

    value = LocalTime;

    return value;
}
