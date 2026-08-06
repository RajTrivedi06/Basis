export function ExhibitCTable() {
  return (
    <figure className="bull-exhibit">
      <figcaption className="bull-exhibit__cap">
        <span>Exhibit C — The translation book, specimen entries</span>
      </figcaption>
      <table className="bull-table">
        <thead>
          <tr>
            <th scope="col">As received</th>
            <th scope="col">Filed as</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>NVIDIA H100 80GB HBM3</td>
            <td>h100_sxm_80gb</td>
          </tr>
          <tr>
            <td>H100 SXM5-80G</td>
            <td>h100_sxm_80gb</td>
          </tr>
          <tr>
            <td>H100-PCIE-80GB</td>
            <td>h100_pcie_80gb — A DIFFERENT SUBJECT</td>
          </tr>
          <tr>
            <td>(region not reported)</td>
            <td>UNKNOWN — ITS OWN GROUP</td>
          </tr>
          <tr>
            <td>GEFORCE RTX 4090 D</td>
            <td className="warn">SET ASIDE &amp; COUNTED — NOT IN THE BOOK</td>
          </tr>
        </tbody>
      </table>
    </figure>
  );
}
